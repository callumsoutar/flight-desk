"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Tabs } from "radix-ui"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconChevronDown,
  IconClipboardList,
  IconHistory,
  IconInfoCircle,
  IconPackage,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react"

import { IssueEquipmentModal } from "@/components/equipment/issue-equipment-modal"
import { ReturnEquipmentModal } from "@/components/equipment/return-equipment-modal"
import { EquipmentIssuanceTable } from "@/components/equipment/equipment-issuance-table"
import { EquipmentUpdatesTable } from "@/components/equipment/equipment-updates-table"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { EquipmentRow } from "@/lib/types"
import {
  EQUIPMENT_STATUS_OPTIONS,
  EQUIPMENT_TYPE_OPTIONS,
  type EquipmentIssuanceMember,
  type EquipmentIssuance,
  type EquipmentStatus,
  type EquipmentType,
  type EquipmentUpdate,
  type EquipmentWithIssuance,
} from "@/lib/types/equipment"

type Props = {
  equipmentId: string
  equipment: EquipmentRow
  issuances: EquipmentIssuance[]
  issuanceUserMap: Record<string, string>
  issuanceError?: string | null
  updates: EquipmentUpdate[]
  updatesUserMap: Record<string, string>
  updatesError?: string | null
  issueMembers: EquipmentIssuanceMember[]
  canIssueEquipment: boolean
  canEdit: boolean
  canDelete: boolean
}

const tabItems = [
  { id: "overview", label: "Overview", icon: IconInfoCircle },
  { id: "issuance", label: "Issuance History", icon: IconClipboardList },
  { id: "updates", label: "Updates", icon: IconHistory },
] as const

type TabId = (typeof tabItems)[number]["id"]

type EquipmentFormState = {
  name: string
  label: string
  serial_number: string
  location: string
  status: EquipmentStatus
  type: EquipmentType
  notes: string
}

function toFormState(equipment: EquipmentRow): EquipmentFormState {
  return {
    name: equipment.name,
    label: equipment.label ?? "",
    serial_number: equipment.serial_number ?? "",
    location: equipment.location ?? "",
    status: equipment.status,
    type: equipment.type,
    notes: equipment.notes ?? "",
  }
}

function getStatusBadgeClass(status: EquipmentStatus) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (status === "maintenance") return "bg-amber-50 text-amber-700 border-amber-200"
  if (status === "lost") return "bg-red-50 text-red-700 border-red-200"
  if (status === "retired") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

function formatStatusLabel(status: EquipmentStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function EquipmentDetailClient({
  equipmentId,
  equipment,
  issuances,
  issuanceUserMap,
  issuanceError,
  updates,
  updatesUserMap,
  updatesError,
  issueMembers,
  canIssueEquipment,
  canEdit,
  canDelete,
}: Props) {
  const router = useRouter()
  const [selectedTab, setSelectedTab] = React.useState<TabId>("overview")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)

  const [formData, setFormData] = React.useState<EquipmentFormState>(() => toFormState(equipment))
  const [initialFormData, setInitialFormData] = React.useState<EquipmentFormState>(() => toFormState(equipment))
  const [isSaving, setIsSaving] = React.useState(false)
  const [issueModalOpen, setIssueModalOpen] = React.useState(false)
  const [returnModalOpen, setReturnModalOpen] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  React.useEffect(() => {
    const next = toFormState(equipment)
    setFormData(next)
    setInitialFormData(next)
  }, [equipment])

  const isDirty = React.useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData)
  }, [formData, initialFormData])

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
    }
  }, [selectedTab])

  const handleSave = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!canEdit) return

    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      toast.error("Name is required")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/equipment/${equipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          label: formData.label.trim() || null,
          serial_number: formData.serial_number.trim() || null,
          location: formData.location.trim() || null,
          status: formData.status,
          type: formData.type,
          notes: formData.notes.trim() || null,
        }),
      })

      const payload = (await response.json().catch(() => null)) as {
        error?: string
        equipment?: EquipmentRow
      } | null

      if (!response.ok || !payload?.equipment) {
        toast.error(payload?.error || "Failed to update equipment")
        return
      }

      const next = toFormState(payload.equipment)
      setFormData(next)
      setInitialFormData(next)
      toast.success("Equipment updated successfully")
      router.refresh()
    } catch {
      toast.error("Network error while saving equipment")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUndo = React.useCallback(() => {
    setFormData(initialFormData)
  }, [initialFormData])

  const handleDelete = async () => {
    if (!canDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/equipment/${equipmentId}`, {
        method: "DELETE",
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        toast.error(payload?.error || "Failed to delete equipment")
        return
      }

      toast.success("Equipment deleted successfully")
      setShowDeleteDialog(false)
      router.push("/equipment")
      router.refresh()
    } catch {
      toast.error("Network error while deleting equipment")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRefreshHistory = React.useCallback(() => {
    router.refresh()
  }, [router])

  const activeIssuance = React.useMemo(
    () => issuances.find((row) => row.returned_at === null) ?? null,
    [issuances]
  )
  const hasActiveIssuance = Boolean(activeIssuance)
  const issueModalEquipment = React.useMemo<EquipmentWithIssuance>(
    () => ({
      ...equipment,
      current_issuance: null,
      issued_to_user: null,
      latest_update: null,
    }),
    [equipment]
  )
  const returnModalEquipment = React.useMemo<EquipmentWithIssuance | null>(() => {
    if (!activeIssuance) return null

    const issuedToDisplayName = issuanceUserMap[activeIssuance.user_id] ?? activeIssuance.user_id

    return {
      ...equipment,
      current_issuance: {
        ...activeIssuance,
        issued_to_user: null,
      },
      issued_to_user: {
        id: activeIssuance.user_id,
        first_name: null,
        last_name: null,
        email: issuedToDisplayName,
      },
      latest_update: null,
    }
  }, [activeIssuance, equipment, issuanceUserMap])

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/equipment"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to Equipment
        </Link>

        <Card className="mb-6 border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
                  <IconPackage className="h-8 w-8 text-slate-600" />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">{formData.name}</h1>
                    <Badge
                      variant="outline"
                      className={cn("px-2 py-0.5 text-xs font-medium", getStatusBadgeClass(formData.status))}
                    >
                      {formatStatusLabel(formData.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:text-sm">
                    <span className="capitalize">{formData.type}</span>
                    {formData.serial_number ? (
                      <>
                        <span>&bull;</span>
                        <span>SN: {formData.serial_number}</span>
                      </>
                    ) : null}
                    {formData.label ? (
                      <>
                        <span>&bull;</span>
                        <span>{formData.label}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {canIssueEquipment || canDelete ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      Options
                      <IconChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canIssueEquipment ? (
                      <DropdownMenuItem
                        onClick={() => {
                          if (hasActiveIssuance) {
                            setReturnModalOpen(true)
                            return
                          }
                          setIssueModalOpen(true)
                        }}
                      >
                        <IconClipboardList className="mr-2 h-4 w-4" />
                        {hasActiveIssuance ? "Return" : "Issue Equipment"}
                      </DropdownMenuItem>
                    ) : null}
                    {canIssueEquipment && canDelete ? <DropdownMenuSeparator /> : null}
                    {canDelete ? (
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <IconTrash className="mr-2 h-4 w-4" />
                        Delete Equipment
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="p-0">
            <Tabs.Root
              value={selectedTab}
              onValueChange={(value: string) => setSelectedTab(value as TabId)}
              className="flex w-full flex-col"
            >
              <div className="relative w-full border-b border-gray-200 bg-white">
                <div className="px-4 pt-3 pb-3 md:hidden">
                  <Select value={selectedTab} onValueChange={(value) => setSelectedTab(value as TabId)}>
                    <SelectTrigger className="h-11 w-full border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                      <SelectValue>
                        {(() => {
                          const activeTabItem = tabItems.find((tab) => tab.id === selectedTab)
                          const Icon = activeTabItem?.icon || IconInfoCircle
                          return (
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-indigo-600" />
                              <span className="font-medium">{activeTabItem?.label || "Select tab"}</span>
                            </div>
                          )
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tabItems.map((tab) => {
                        const Icon = tab.icon
                        const isCurrent = selectedTab === tab.id
                        return (
                          <SelectItem key={tab.id} value={tab.id} className={isCurrent ? "bg-indigo-50" : ""}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-4 w-4", isCurrent ? "text-indigo-600" : "text-gray-500")} />
                              <span className={cn(isCurrent ? "font-semibold text-indigo-900" : "")}>
                                {tab.label}
                              </span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="hidden items-center px-6 pt-2 md:flex">
                  <div className="scrollbar-hide flex w-full items-center overflow-x-auto scroll-smooth">
                    <Tabs.List
                      ref={tabsListRef}
                      className="relative flex min-h-[48px] min-w-max flex-row gap-1"
                      aria-label="Equipment tabs"
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
                            ref={(el: HTMLButtonElement | null) => {
                              tabRefs.current[tab.id] = el
                            }}
                            value={tab.id}
                            className="inline-flex min-h-[48px] min-w-[44px] flex-shrink-0 touch-manipulation cursor-pointer items-center gap-2 border-b-2 border-transparent bg-none px-4 py-3 pb-1 text-base font-medium whitespace-nowrap text-gray-500 transition-all duration-200 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none active:bg-gray-50 data-[state=active]:text-indigo-800"
                            style={{ boxShadow: "none", borderRadius: 0 }}
                            aria-label={`${tab.label} tab`}
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
                <Tabs.Content value="overview">
                  <form id="equipment-detail-form" className="space-y-8 pb-24" onSubmit={handleSave}>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                      <h3 className="mb-5 flex items-center gap-2 text-base font-bold tracking-tight text-gray-900">
                        <IconSettings className="h-5 w-5 text-indigo-600" />
                        Equipment Details
                      </h3>

                      {!canEdit ? (
                        <p className="mb-4 text-sm text-muted-foreground">
                          You have read-only access to this equipment record.
                        </p>
                      ) : null}

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Name</label>
                          <Input
                            value={formData.name}
                            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Equipment Name"
                            disabled={!canEdit || isSaving}
                            className="border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Label</label>
                          <Input
                            value={formData.label}
                            onChange={(event) => setFormData((prev) => ({ ...prev, label: event.target.value }))}
                            placeholder="Label"
                            disabled={!canEdit || isSaving}
                            className="border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Serial Number</label>
                          <Input
                            value={formData.serial_number}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, serial_number: event.target.value }))
                            }
                            placeholder="Serial Number"
                            disabled={!canEdit || isSaving}
                            className="border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Location</label>
                          <Input
                            value={formData.location}
                            onChange={(event) => setFormData((prev) => ({ ...prev, location: event.target.value }))}
                            placeholder="Location"
                            disabled={!canEdit || isSaving}
                            className="border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Status</label>
                          <Select
                            value={formData.status}
                            onValueChange={(value) =>
                              setFormData((prev) => ({ ...prev, status: value as EquipmentStatus }))
                            }
                            disabled={!canEdit || isSaving}
                          >
                            <SelectTrigger className="w-full border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Type</label>
                          <Select
                            value={formData.type}
                            onValueChange={(value) =>
                              setFormData((prev) => ({ ...prev, type: value as EquipmentType }))
                            }
                            disabled={!canEdit || isSaving}
                          >
                            <SelectTrigger className="w-full border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-6">
                        <label className="mb-1.5 block text-sm font-semibold text-gray-700">Notes</label>
                        <Textarea
                          value={formData.notes}
                          onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                          placeholder="Notes"
                          disabled={!canEdit || isSaving}
                          className="min-h-[120px] resize-y border-gray-200 bg-white transition-all focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </form>
                </Tabs.Content>

                <Tabs.Content value="issuance">
                  <EquipmentIssuanceTable
                    issuances={issuances}
                    userMap={issuanceUserMap}
                    error={issuanceError ?? null}
                  />
                </Tabs.Content>

                <Tabs.Content value="updates">
                  <EquipmentUpdatesTable
                    updates={updates}
                    userMap={updatesUserMap}
                    error={updatesError ?? null}
                    equipment={equipment}
                    refresh={handleRefreshHistory}
                  />
                </Tabs.Content>
              </div>
            </Tabs.Root>
          </CardContent>
        </Card>
      </div>

      {selectedTab === "overview" && canEdit ? (
        <StickyFormActions
          formId="equipment-detail-form"
          isDirty={isDirty}
          isSaving={isSaving}
          onUndo={handleUndo}
          message="You have unsaved equipment details."
          undoLabel="Undo changes"
          saveLabel="Save"
        />
      ) : null}

      <IssueEquipmentModal
        open={issueModalOpen}
        onOpenChange={setIssueModalOpen}
        equipment={issueModalEquipment}
        members={issueMembers}
        onSuccess={handleRefreshHistory}
      />
      <ReturnEquipmentModal
        open={returnModalOpen}
        onOpenChange={setReturnModalOpen}
        equipment={returnModalEquipment}
        onSuccess={handleRefreshHistory}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconTrash className="h-5 w-5 text-destructive" />
              Delete Equipment
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{formData.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Equipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
