"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as Tabs from "@radix-ui/react-tabs"
import {
  IconArrowLeft,
  IconCalendar,
  IconChartBar,
  IconChevronDown,
  IconCreditCard,
  IconHistory,
  IconMail,
  IconReceipt,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { MemberContactDetails } from "@/components/members/member-contact-details"
import { MemberFinances } from "@/components/members/member-finances"
import { MemberFlightHistoryTab } from "@/components/members/member-flight-history-tab"
import { MemberMemberships } from "@/components/members/member-memberships"
import { MemberPilotDetails } from "@/components/members/member-pilot-details"
import { MemberTrainingTab } from "@/components/members/member-training-tab"
import { MemberUpcomingBookingsTable } from "@/components/members/member-upcoming-bookings-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import type {
  EndorsementLite,
  LicenseLite,
  MemberDetailWithRelations,
  UserEndorsementWithRelation,
} from "@/lib/types/members"
import type {
  MembershipSummary,
  TenantDefaultTaxRate,
  MembershipTypeWithChargeable,
} from "@/lib/types/memberships"
import { getUserInitials } from "@/lib/utils"

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function EmptyTabPanel({ title }: { title: string }) {
  return (
    <Card className="border border-border/60 bg-white shadow-sm">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">Content for this section will be added next.</p>
      </CardContent>
    </Card>
  )
}

export function MemberDetailClient({
  member,
  availableLicenses,
  availableEndorsements,
  initialUserEndorsements,
  initialMembershipSummary,
  membershipTypes,
  defaultTaxRate,
}: {
  member: MemberDetailWithRelations
  availableLicenses: LicenseLite[]
  availableEndorsements: EndorsementLite[]
  initialUserEndorsements: UserEndorsementWithRelation[]
  initialMembershipSummary: MembershipSummary
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
}) {
  const router = useRouter()
  const [currentMember, setCurrentMember] = React.useState(member)
  const [currentUserEndorsements, setCurrentUserEndorsements] = React.useState(
    initialUserEndorsements
  )
  const [activeTab, setActiveTab] = React.useState("contact")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)
  const [isContactDirty, setIsContactDirty] = React.useState(false)
  const [isContactSaving, setIsContactSaving] = React.useState(false)
  const contactUndoRef = React.useRef<(() => void) | null>(null)
  const [isPilotDirty, setIsPilotDirty] = React.useState(false)
  const [isPilotSaving, setIsPilotSaving] = React.useState(false)
  const pilotUndoRef = React.useRef<(() => void) | null>(null)

  React.useEffect(() => {
    setCurrentMember(member)
    setIsContactDirty(false)
    setIsPilotDirty(false)
  }, [member])

  React.useEffect(() => {
    setCurrentUserEndorsements(initialUserEndorsements)
  }, [initialUserEndorsements])

  React.useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab]
    const tabsList = tabsListRef.current

    if (activeTabElement && tabsList) {
      const tabsListRect = tabsList.getBoundingClientRect()
      const activeTabRect = activeTabElement.getBoundingClientRect()

      setUnderlineStyle({
        left: activeTabRect.left - tabsListRect.left,
        width: activeTabRect.width,
      })

      if (window.innerWidth < 768) {
        const scrollLeft = tabsList.scrollLeft
        const tabLeft = activeTabRect.left - tabsListRect.left
        const tabWidth = activeTabRect.width
        const containerWidth = tabsListRect.width
        const targetScroll =
          scrollLeft + tabLeft - containerWidth / 2 + tabWidth / 2

        tabsList.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: "smooth",
        })
      }
    }
  }, [activeTab])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const activeTabElement = tabRefs.current[activeTab]
      const tabsList = tabsListRef.current

      if (activeTabElement && tabsList) {
        const tabsListRect = tabsList.getBoundingClientRect()
        const activeTabRect = activeTabElement.getBoundingClientRect()

        setUnderlineStyle({
          left: activeTabRect.left - tabsListRect.left,
          width: activeTabRect.width,
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [activeTab])

  React.useEffect(() => {
    const tabsList = tabsListRef.current
    if (!tabsList) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = tabsList
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }

    checkScroll()
    tabsList.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)

    return () => {
      tabsList.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [activeTab])

  const firstName = currentMember.user?.first_name ?? ""
  const lastName = currentMember.user?.last_name ?? ""
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    currentMember.user?.email ||
    "Unknown Member"
  const initials = getUserInitials(firstName, lastName, currentMember.user?.email)
  const isActive = currentMember.is_active
  const membershipStartDate = currentMember.membership?.start_date
    ? formatDate(currentMember.membership.start_date)
    : null

  const tabItems = [
    { id: "contact", label: "Contact", icon: IconMail },
    { id: "pilot", label: "Pilot Details", icon: IconUser },
    { id: "memberships", label: "Memberships", icon: IconUsers },
    { id: "finances", label: "Finances", icon: IconCreditCard },
    { id: "flights", label: "Bookings", icon: IconCalendar },
    { id: "logbook", label: "Logbook", icon: IconHistory },
    { id: "training", label: "Training", icon: IconChartBar },
    { id: "account", label: "Account", icon: IconUser },
  ]

  const onNewBooking = () => {
    toast.info("Booking flow will be wired next.")
  }

  return (
    <div className="w-full py-8">
      <Link
        href="/members"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to Members
      </Link>

      <Card className="mb-6 border border-border/50 bg-card shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 rounded-full border-0 bg-gray-100">
                <AvatarFallback className="bg-gray-100 text-xl font-bold text-gray-600">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="break-words text-2xl font-bold text-gray-900">
                    {fullName}
                  </h1>
                  <Badge
                    className={
                      isActive
                        ? "rounded-md border-0 bg-green-100 px-2 py-1 text-xs font-medium whitespace-nowrap text-green-700"
                        : "rounded-md border-0 bg-red-100 px-2 py-1 text-xs font-medium whitespace-nowrap text-red-700"
                    }
                  >
                    {isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 sm:gap-4 sm:text-sm">
                  {currentMember.user?.email ? <span>{currentMember.user.email}</span> : null}
                  {currentMember.user?.phone ? <span>{currentMember.user.phone}</span> : null}
                  {membershipStartDate ? (
                    <span>Member since {membershipStartDate}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
                  >
                    Quick Actions
                    <IconChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={onNewBooking}>
                    <IconCalendar className="mr-2 h-4 w-4" />
                    New Booking
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/invoices/new?user_id=${currentMember.user_id}`)
                    }
                  >
                    <IconReceipt className="mr-2 h-4 w-4" />
                    New Invoice
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                className="w-full bg-[#6564db] font-semibold text-white shadow-sm hover:bg-[#232ed1] sm:w-auto"
                onClick={onNewBooking}
              >
                <IconCalendar className="mr-2 h-4 w-4" />
                New Booking
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card shadow-sm">
        <CardContent className="p-0">
          <Tabs.Root
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex w-full flex-col"
          >
            <div className="relative w-full border-b border-gray-200 bg-white">
              <div className="px-4 pt-3 pb-3 md:hidden">
                <Select value={activeTab} onValueChange={setActiveTab}>
                  <SelectTrigger className="h-11 w-full border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                    {(() => {
                      const activeTabItem =
                        tabItems.find((tab) => tab.id === activeTab) ??
                        tabItems[0]
                      const Icon = activeTabItem.icon
                      return (
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-indigo-600" />
                          <span className="font-medium">
                            {activeTabItem.label}
                          </span>
                        </div>
                      )
                    })()}
                  </SelectTrigger>
                  <SelectContent>
                    {tabItems.map((tab) => {
                      const Icon = tab.icon
                      const isActiveTab = activeTab === tab.id
                      return (
                        <SelectItem
                          key={tab.id}
                          value={tab.id}
                          className={isActiveTab ? "bg-indigo-50" : ""}
                        >
                          <div className="flex items-center gap-2">
                            <Icon
                              className={
                                isActiveTab
                                  ? "h-4 w-4 text-indigo-600"
                                  : "h-4 w-4 text-gray-500"
                              }
                            />
                            <span
                              className={
                                isActiveTab
                                  ? "font-semibold text-indigo-900"
                                  : undefined
                              }
                            >
                              {tab.label}
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative hidden items-center px-6 pt-2 md:flex">
                {showScrollLeft ? (
                  <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent" />
                ) : null}
                {showScrollRight ? (
                  <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l from-white to-transparent" />
                ) : null}

                <div className="w-full overflow-x-auto scrollbar-hide scroll-smooth">
                  <Tabs.List
                    ref={tabsListRef}
                    className="relative flex min-h-[48px] min-w-max flex-row gap-1"
                    aria-label="Member tabs"
                  >
                    <div
                      className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                      style={{
                        left: `${underlineStyle.left}px`,
                        width: `${underlineStyle.width}px`,
                      }}
                    />
                    {tabItems.map((tab) => {
                      const Icon = tab.icon
                      return (
                        <Tabs.Trigger
                          key={tab.id}
                          ref={(el) => {
                            tabRefs.current[tab.id] = el
                          }}
                          value={tab.id}
                          className="inline-flex min-h-[48px] min-w-[44px] flex-shrink-0 cursor-pointer touch-manipulation items-center gap-2 border-b-2 border-transparent px-4 py-3 pb-1 text-base font-medium whitespace-nowrap text-gray-500 transition-all duration-200 hover:text-indigo-600 data-[state=active]:text-indigo-800"
                          style={{
                            background: "none",
                            boxShadow: "none",
                            borderRadius: 0,
                          }}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <span>{tab.label}</span>
                        </Tabs.Trigger>
                      )
                    })}
                  </Tabs.List>
                </div>
              </div>
            </div>

            <div className="w-full p-4 sm:p-6">
              <Tabs.Content value="contact">
                <MemberContactDetails
                  memberId={currentMember.user_id}
                  member={currentMember}
                  onDirtyChange={setIsContactDirty}
                  onSavingChange={setIsContactSaving}
                  onUndoRef={contactUndoRef}
                  onSaved={(values) => {
                    setCurrentMember((prev) => ({
                      ...prev,
                      user: prev.user
                        ? {
                            ...prev.user,
                            first_name: values.first_name,
                            last_name: values.last_name,
                            email: values.email,
                            phone: values.phone,
                            street_address: values.street_address,
                            gender: values.gender,
                            date_of_birth: values.date_of_birth,
                            notes: values.notes,
                            next_of_kin_name: values.next_of_kin_name,
                            next_of_kin_phone: values.next_of_kin_phone,
                            company_name: values.company_name,
                            occupation: values.occupation,
                            employer: values.employer,
                          }
                        : null,
                    }))
                  }}
                  formId="member-contact-form"
                />
              </Tabs.Content>
              <Tabs.Content value="pilot">
                <MemberPilotDetails
                  memberId={currentMember.user_id}
                  member={currentMember}
                  availableLicenses={availableLicenses}
                  availableEndorsements={availableEndorsements}
                  initialUserEndorsements={currentUserEndorsements}
                  onDirtyChange={setIsPilotDirty}
                  onSavingChange={setIsPilotSaving}
                  onUndoRef={pilotUndoRef}
                  onPilotSaved={(values) => {
                    setCurrentMember((prev) => ({
                      ...prev,
                      user: prev.user
                        ? {
                            ...prev.user,
                            pilot_license_number: values.pilot_license_number,
                            pilot_license_type: values.pilot_license_type,
                            pilot_license_id: values.pilot_license_id,
                            pilot_license_expiry: values.pilot_license_expiry,
                            medical_certificate_expiry: values.medical_certificate_expiry,
                          }
                        : null,
                    }))
                  }}
                  formId="member-pilot-form"
                />
              </Tabs.Content>
              <Tabs.Content value="memberships">
                <MemberMemberships
                  memberId={currentMember.user_id}
                  initialSummary={initialMembershipSummary}
                  membershipTypes={membershipTypes}
                  defaultTaxRate={defaultTaxRate}
                />
              </Tabs.Content>
              <Tabs.Content value="finances">
                <MemberFinances memberId={currentMember.user_id} />
              </Tabs.Content>
              <Tabs.Content value="flights">
                <MemberUpcomingBookingsTable memberId={currentMember.user_id} />
              </Tabs.Content>
              <Tabs.Content value="logbook">
                <MemberFlightHistoryTab memberId={currentMember.user_id} />
              </Tabs.Content>
              <Tabs.Content value="training">
                <MemberTrainingTab memberId={currentMember.user_id} />
              </Tabs.Content>
              <Tabs.Content value="account">
                <EmptyTabPanel title="Account" />
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </CardContent>
      </Card>

      {activeTab === "contact" ? (
        <StickyFormActions
          formId="member-contact-form"
          isDirty={isContactDirty}
          isSaving={isContactSaving}
          onUndo={() => contactUndoRef.current?.()}
          message="You have unsaved contact details."
          saveLabel="Save Changes"
        />
      ) : null}
      {activeTab === "pilot" ? (
        <StickyFormActions
          formId="member-pilot-form"
          isDirty={isPilotDirty}
          isSaving={isPilotSaving}
          onUndo={() => pilotUndoRef.current?.()}
          message="You have unsaved pilot details."
          saveLabel="Save Changes"
        />
      ) : null}
    </div>
  )
}
