"use client"

import * as React from "react"
import Link from "next/link"
import * as Tabs from "@radix-ui/react-tabs"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconBriefcase,
  IconCertificate,
  IconClock,
  IconCurrencyDollar,
  IconMail,
  IconNotes,
  IconPhone,
  IconShieldCheck,
  IconUser,
} from "@tabler/icons-react"

import {
  updateInstructorDetailsAction,
  updateInstructorNotesAction,
} from "@/app/instructors/actions"
import { InstructorChargeRatesTable } from "@/components/instructors/instructor-charge-rates-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { getUserInitials } from "@/lib/utils"
import type {
  InstructorCategoryLite,
  InstructorDetailWithRelations,
  InstructorFlightTypeLite,
  InstructorRateWithFlightType,
} from "@/lib/types/instructors"

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deactivated", label: "Deactivated" },
  { value: "suspended", label: "Suspended" },
] as const

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "casual", label: "Casual" },
  { value: "contractor", label: "Contractor" },
] as const

const SELECT_NONE = "__none__" as const

type DetailsFormValues = {
  first_name: string
  last_name: string
  rating: string | null
  instructor_check_due_date: string | null
  instrument_check_due_date: string | null
  class_1_medical_due_date: string | null
  employment_type: (typeof EMPLOYMENT_TYPES)[number]["value"] | null
  is_actively_instructing: boolean
  status: (typeof STATUS_OPTIONS)[number]["value"]
  night_removal: boolean
  aerobatics_removal: boolean
  multi_removal: boolean
  tawa_removal: boolean
  ifr_removal: boolean
}

type FormErrors = {
  first_name?: string
  last_name?: string
}

type InstructorDetailClientProps = {
  instructor: InstructorDetailWithRelations
  instructorCategories: InstructorCategoryLite[]
  rates: InstructorRateWithFlightType[]
  flightTypes: InstructorFlightTypeLite[]
  defaultTaxRate: number | null
}

type CertificationFieldName =
  | "instructor_check_due_date"
  | "instrument_check_due_date"
  | "class_1_medical_due_date"

const CERTIFICATION_FIELDS: Array<{ name: CertificationFieldName; label: string }> = [
  { name: "instructor_check_due_date", label: "Instructor check due" },
  { name: "instrument_check_due_date", label: "Instrument check due" },
  { name: "class_1_medical_due_date", label: "Class 1 medical due" },
]

type EndorsementFieldName =
  | "night_removal"
  | "aerobatics_removal"
  | "multi_removal"
  | "tawa_removal"
  | "ifr_removal"

const ENDORSEMENT_FIELDS: Array<{ name: EndorsementFieldName; label: string }> = [
  { name: "night_removal", label: "Night removal" },
  { name: "aerobatics_removal", label: "Aerobatics removal" },
  { name: "multi_removal", label: "Multi removal" },
  { name: "tawa_removal", label: "TAWA removal" },
  { name: "ifr_removal", label: "IFR removal" },
]

const tabItems = [
  { id: "details", label: "Details", icon: IconUser },
  { id: "rates", label: "Charge Rates", icon: IconCurrencyDollar },
  { id: "history", label: "History", icon: IconClock },
  { id: "notes", label: "Notes", icon: IconNotes },
] as const

type TabId = (typeof tabItems)[number]["id"]

function buildDetailsFormValues(instructor: InstructorDetailWithRelations): DetailsFormValues {
  return {
    first_name: instructor.user?.first_name ?? instructor.first_name ?? "",
    last_name: instructor.user?.last_name ?? instructor.last_name ?? "",
    rating: instructor.rating ?? null,
    instructor_check_due_date: instructor.instructor_check_due_date ?? null,
    instrument_check_due_date: instructor.instrument_check_due_date ?? null,
    class_1_medical_due_date: instructor.class_1_medical_due_date ?? null,
    employment_type: instructor.employment_type ?? null,
    is_actively_instructing: instructor.is_actively_instructing,
    status: instructor.status,
    night_removal: Boolean(instructor.night_removal),
    aerobatics_removal: Boolean(instructor.aerobatics_removal),
    multi_removal: Boolean(instructor.multi_removal),
    tawa_removal: Boolean(instructor.tawa_removal),
    ifr_removal: Boolean(instructor.ifr_removal),
  }
}

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-green-100 text-green-700"
  if (status === "inactive") return "bg-yellow-100 text-amber-700"
  if (status === "deactivated" || status === "suspended") return "bg-red-100 text-red-700"
  return "bg-zinc-200 text-zinc-600"
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function isEqualDetails(a: DetailsFormValues, b: DetailsFormValues) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function InstructorDetailClient({
  instructor,
  instructorCategories,
  rates,
  flightTypes,
  defaultTaxRate,
}: InstructorDetailClientProps) {
  const detailsFormId = "instructor-details-form"
  const notesFormId = "instructor-notes-form"

  const [selectedTab, setSelectedTab] = React.useState<TabId>("details")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  const [currentInstructor, setCurrentInstructor] = React.useState(instructor)
  const [detailsValues, setDetailsValues] = React.useState<DetailsFormValues>(() =>
    buildDetailsFormValues(instructor)
  )
  const [notesValue, setNotesValue] = React.useState(instructor.notes ?? "")
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [isSavingDetails, setIsSavingDetails] = React.useState(false)
  const [isSavingNotes, setIsSavingNotes] = React.useState(false)

  React.useEffect(() => {
    setCurrentInstructor(instructor)
    setDetailsValues(buildDetailsFormValues(instructor))
    setNotesValue(instructor.notes ?? "")
  }, [instructor])

  React.useEffect(() => {
    const activeTabElement = tabRefs.current[selectedTab]
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
        const targetScroll = scrollLeft + tabLeft - containerWidth / 2 + tabWidth / 2

        tabsList.scrollTo({ left: Math.max(0, targetScroll), behavior: "smooth" })
      }
    }
  }, [selectedTab])

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
  }, [selectedTab])

  const initialDetailsValues = React.useMemo(
    () => buildDetailsFormValues(currentInstructor),
    [currentInstructor]
  )
  const initialNotesValue = currentInstructor.notes ?? ""

  const isDetailsDirty = React.useMemo(
    () => !isEqualDetails(detailsValues, initialDetailsValues),
    [detailsValues, initialDetailsValues]
  )
  const isNotesDirty = notesValue !== initialNotesValue

  const initials = getUserInitials(
    currentInstructor.user?.first_name,
    currentInstructor.user?.last_name,
    currentInstructor.user?.email
  )

  const fullName = [currentInstructor.user?.first_name, currentInstructor.user?.last_name]
    .filter(Boolean)
    .join(" ")

  const handleDetailsChange = <K extends keyof DetailsFormValues>(
    key: K,
    value: DetailsFormValues[K]
  ) => {
    setDetailsValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleResetDetails = React.useCallback(() => {
    setDetailsValues(buildDetailsFormValues(currentInstructor))
    setErrors({})
  }, [currentInstructor])

  const handleResetNotes = React.useCallback(() => {
    setNotesValue(currentInstructor.notes ?? "")
  }, [currentInstructor])

  const handleSaveDetails = async (event: React.FormEvent) => {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    if (!detailsValues.first_name.trim()) nextErrors.first_name = "First name is required"
    if (!detailsValues.last_name.trim()) nextErrors.last_name = "Last name is required"

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields")
      return
    }

    setIsSavingDetails(true)
    const result = await updateInstructorDetailsAction({
      userId: currentInstructor.user_id,
      ...detailsValues,
    })
    setIsSavingDetails(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Instructor updated")
    setCurrentInstructor(result.instructor)
    setDetailsValues(buildDetailsFormValues(result.instructor))
    setNotesValue(result.instructor.notes ?? "")
    setErrors({})
  }

  const handleSaveNotes = async (event: React.FormEvent) => {
    event.preventDefault()

    setIsSavingNotes(true)
    const result = await updateInstructorNotesAction({
      userId: currentInstructor.user_id,
      notes: notesValue,
    })
    setIsSavingNotes(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Notes saved")
    setCurrentInstructor(result.instructor)
    setNotesValue(result.instructor.notes ?? "")
  }

  return (
    <div className="mx-auto w-full max-w-6xl py-8">
      <Link
        href="/instructors"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to Instructors
      </Link>

      <Card className="mb-6 border border-border/50 bg-card shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 rounded-full border-0 bg-gray-100">
                <AvatarFallback className="bg-gray-100 text-xl font-bold text-gray-600">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="mb-1 flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {fullName || currentInstructor.user?.email || "Unknown Instructor"}
                  </h1>
                  <Badge
                    className={`rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClass(currentInstructor.status)}`}
                  >
                    {currentInstructor.status.charAt(0).toUpperCase() + currentInstructor.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 sm:text-sm">
                  {currentInstructor.user?.email ? (
                    <span className="flex items-center gap-1">
                      <IconMail className="h-3 w-3" />
                      {currentInstructor.user.email}
                    </span>
                  ) : null}
                  {currentInstructor.user?.phone ? (
                    <span className="flex items-center gap-1">
                      <IconPhone className="h-3 w-3" />
                      {currentInstructor.user.phone}
                    </span>
                  ) : null}
                  {currentInstructor.hire_date ? (
                    <span>Hired {formatDate(currentInstructor.hire_date)}</span>
                  ) : null}
                  {currentInstructor.rating_category?.name ? (
                    <span className="flex items-center gap-1">
                      <IconCertificate className="h-3 w-3" />
                      Instructor category: {currentInstructor.rating_category.name}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card shadow-sm">
        <CardContent className="p-0">
          <Tabs.Root
            value={selectedTab}
            onValueChange={(value) => setSelectedTab(value as TabId)}
            className="flex w-full flex-col"
          >
            <div className="relative w-full border-b border-gray-200 bg-white">
              <div className="px-4 pb-3 pt-3 md:hidden">
                <Select value={selectedTab} onValueChange={(value) => setSelectedTab(value as TabId)}>
                  <SelectTrigger className="h-11 w-full border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                    <SelectValue>
                      {(() => {
                        const activeTabItem = tabItems.find((tab) => tab.id === selectedTab) ?? tabItems[0]
                        const Icon = activeTabItem.icon
                        return (
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-indigo-600" />
                            <span className="font-medium">{activeTabItem.label}</span>
                          </div>
                        )
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {tabItems.map((tab) => {
                      const Icon = tab.icon
                      const isActive = selectedTab === tab.id
                      return (
                        <SelectItem key={tab.id} value={tab.id} className={isActive ? "bg-indigo-50" : ""}>
                          <div className="flex items-center gap-2">
                            <Icon className={isActive ? "h-4 w-4 text-indigo-600" : "h-4 w-4 text-gray-500"} />
                            <span className={isActive ? "font-semibold text-indigo-900" : ""}>{tab.label}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative hidden items-center px-6 pt-2 md:flex">
                {showScrollLeft ? (
                  <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-white to-transparent" />
                ) : null}
                {showScrollRight ? (
                  <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-white to-transparent" />
                ) : null}

                <div className="w-full overflow-x-auto scroll-smooth scrollbar-hide">
                  <Tabs.List
                    ref={tabsListRef}
                    className="relative flex min-h-[48px] min-w-max flex-row gap-1"
                    aria-label="Instructor tabs"
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
                          className="inline-flex min-h-[48px] min-w-[44px] flex-shrink-0 cursor-pointer touch-manipulation items-center gap-2 border-b-2 border-transparent px-4 pb-1 py-3 text-base font-medium whitespace-nowrap text-gray-500 transition-all duration-200 hover:text-indigo-600 data-[state=active]:text-indigo-800"
                          style={{ background: "none", boxShadow: "none", borderRadius: 0 }}
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
              <Tabs.Content value="details">
                <form id={detailsFormId} onSubmit={handleSaveDetails} className="space-y-8 pb-32">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                      <h3 className="mb-5 flex items-center gap-2 text-base font-bold tracking-tight text-gray-900">
                        <IconUser className="h-5 w-5 text-indigo-600" />
                        Personal Profile
                      </h3>
                      <div className="grid grid-cols-1 gap-5">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">First name</label>
                          <Input
                            value={detailsValues.first_name}
                            onChange={(event) => handleDetailsChange("first_name", event.target.value)}
                            placeholder="First name"
                            className="border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500"
                          />
                          {errors.first_name ? (
                            <p className="mt-1.5 text-xs font-medium text-red-500">{errors.first_name}</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Last name</label>
                          <Input
                            value={detailsValues.last_name}
                            onChange={(event) => handleDetailsChange("last_name", event.target.value)}
                            placeholder="Last name"
                            className="border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500"
                          />
                          {errors.last_name ? (
                            <p className="mt-1.5 text-xs font-medium text-red-500">{errors.last_name}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                      <h3 className="mb-5 flex items-center gap-2 text-base font-bold tracking-tight text-gray-900">
                        <IconBriefcase className="h-5 w-5 text-indigo-600" />
                        Employment
                      </h3>
                      <div className="grid grid-cols-1 gap-5">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Employment type</label>
                          <Select
                            value={detailsValues.employment_type ?? SELECT_NONE}
                            onValueChange={(value) =>
                              handleDetailsChange(
                                "employment_type",
                                value === SELECT_NONE
                                  ? null
                                  : (value as DetailsFormValues["employment_type"])
                              )
                            }
                          >
                            <SelectTrigger className="w-full border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500">
                              <SelectValue placeholder="Select type">
                                {detailsValues.employment_type
                                  ? EMPLOYMENT_TYPES.find(
                                      (item) => item.value === detailsValues.employment_type
                                    )?.label ?? "Unknown"
                                  : "Not set"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SELECT_NONE}>Not set</SelectItem>
                              {EMPLOYMENT_TYPES.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Status</label>
                            <Select
                              value={detailsValues.status}
                              onValueChange={(value) =>
                                handleDetailsChange("status", value as DetailsFormValues["status"])
                              }
                            >
                              <SelectTrigger className="w-full border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500">
                                <SelectValue placeholder="Select status">
                                  {STATUS_OPTIONS.find((item) => item.value === detailsValues.status)?.label ??
                                    "Active"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col justify-end pb-2">
                            <label className="flex cursor-pointer select-none items-center gap-3 text-sm font-semibold text-gray-700">
                              <Switch
                                checked={detailsValues.is_actively_instructing}
                                onCheckedChange={(value) =>
                                  handleDetailsChange("is_actively_instructing", value)
                                }
                              />
                              Actively instructing
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                    <h3 className="mb-5 flex items-center gap-2 text-base font-bold tracking-tight text-gray-900">
                      <IconCertificate className="h-5 w-5 text-indigo-600" />
                      Qualifications & Certification
                    </h3>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                      <div className="lg:col-span-1">
                        <label className="mb-1.5 block text-sm font-semibold text-gray-700">Instructor Rating</label>
                        <Select
                          value={detailsValues.rating ?? SELECT_NONE}
                          onValueChange={(value) =>
                            handleDetailsChange("rating", value === SELECT_NONE ? null : value)
                          }
                        >
                          <SelectTrigger className="w-full border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500">
                            <SelectValue placeholder="Select rating">
                              {detailsValues.rating
                                ? instructorCategories.find(
                                    (category) => category.id === detailsValues.rating
                                  )?.name ?? "Unknown"
                                : "Not set"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SELECT_NONE}>Not set</SelectItem>
                            {instructorCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {CERTIFICATION_FIELDS.map((field) => (
                        <div key={field.name}>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">{field.label}</label>
                          <DatePicker
                            date={detailsValues[field.name]}
                            onChange={(value) => handleDetailsChange(field.name, value)}
                            className="h-9 w-full border-gray-200 bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                    <h3 className="mb-5 flex items-center gap-2 text-base font-bold tracking-tight text-gray-900">
                      <IconShieldCheck className="h-5 w-5 text-indigo-600" />
                      Instructor Endorsements
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {ENDORSEMENT_FIELDS.map((endorsement) => (
                        <div
                          key={endorsement.name}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-indigo-200"
                        >
                          <span className="text-sm font-medium text-gray-700">{endorsement.label}</span>
                          <Switch
                            checked={detailsValues[endorsement.name]}
                            onCheckedChange={(value) => handleDetailsChange(endorsement.name, value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </Tabs.Content>

              <Tabs.Content value="rates">
                <div className="space-y-6">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-bold tracking-tight text-gray-900">Instructor Charge Rates</h3>
                    <p className="text-sm text-gray-500">
                      Configure how much this instructor charges for different flight types.
                    </p>
                  </div>
                  <InstructorChargeRatesTable
                    instructorId={currentInstructor.id}
                    initialRates={rates}
                    flightTypes={flightTypes}
                    defaultTaxRate={defaultTaxRate}
                  />
                </div>
              </Tabs.Content>

              <Tabs.Content value="history">
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <IconClock className="h-6 w-6 text-gray-400" />
                  </div>
                  <h4 className="mb-1 text-base font-semibold text-gray-900">No Activity Yet</h4>
                  <p className="mx-auto max-w-xs text-sm text-gray-500">
                    Activity history for this instructor will appear here as bookings and logs are created.
                  </p>
                </div>
              </Tabs.Content>

              <Tabs.Content value="notes">
                <form id={notesFormId} onSubmit={handleSaveNotes} className="space-y-6 pb-32">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                    <h3 className="mb-5 flex items-center gap-2 text-base font-bold tracking-tight text-gray-900">
                      <IconNotes className="h-5 w-5 text-indigo-600" />
                      Instructor Notes
                    </h3>
                    <Textarea
                      value={notesValue}
                      onChange={(event) => setNotesValue(event.target.value)}
                      className="min-h-[250px] resize-y border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="Add internal notes about this instructor, performance reviews, or specific requirements..."
                    />
                    <p className="mt-3 text-xs italic text-muted-foreground">
                      These notes are only visible to staff and administrators.
                    </p>
                  </div>
                </form>
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </CardContent>
      </Card>

      {selectedTab === "details" ? (
        <StickyFormActions
          formId={detailsFormId}
          isDirty={isDetailsDirty}
          isSaving={isSavingDetails}
          onUndo={handleResetDetails}
          message="You have unsaved instructor details."
          saveLabel="Save details"
        />
      ) : null}

      {selectedTab === "notes" ? (
        <StickyFormActions
          formId={notesFormId}
          isDirty={isNotesDirty}
          isSaving={isSavingNotes}
          onUndo={handleResetNotes}
          message="You have unsaved notes."
          saveLabel="Save notes"
        />
      ) : null}
    </div>
  )
}
