"use client"

import * as React from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { IconBook2, IconCertificate, IconFileText, IconNotebook, IconTrophy } from "@tabler/icons-react"

import { EndorsementsConfig } from "@/components/settings/training/endorsements-config"
import { ExamsConfig } from "@/components/settings/training/exams-config"
import { ExperienceTypesConfig } from "@/components/settings/training/experience-types-config"
import { LessonsTab } from "@/components/settings/training/lessons-tab"
import { SyllabusConfig } from "@/components/settings/training/syllabus-config"

const trainingTabs = [
  { id: "training-programs", label: "Training Programs", icon: IconNotebook },
  { id: "lessons", label: "Lessons", icon: IconBook2 },
  { id: "exams", label: "Exams", icon: IconFileText },
  { id: "certifications", label: "Certifications", icon: IconCertificate },
  { id: "experience-types", label: "Experience Types", icon: IconTrophy },
] as const

// Training is an intentionally client-owned editor surface; the server page bootstraps the
// surrounding settings shell, while the training resources manage their own query state.
export function TrainingTab() {
  const [activeTab, setActiveTab] = React.useState<(typeof trainingTabs)[number]["id"]>("training-programs")
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  React.useEffect(() => {
    const activeElement = tabRefs.current[activeTab]
    if (activeElement && tabsListRef.current) {
      const listRect = tabsListRef.current.getBoundingClientRect()
      const activeRect = activeElement.getBoundingClientRect()
      setUnderlineStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      })
    }
  }, [activeTab])

  React.useEffect(() => {
    const checkScroll = () => {
      if (!tabsListRef.current) return
      const { scrollLeft, scrollWidth, clientWidth } = tabsListRef.current
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft + clientWidth < scrollWidth)
    }

    checkScroll()
    const listElement = tabsListRef.current
    listElement?.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)
    return () => {
      listElement?.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Training</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure experience types, training programs, lessons, exams, and certifications.
          </p>
        </div>
      </div>

      <Tabs.Root value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex w-full flex-col">
        <div className="relative -mx-4 border-b border-slate-200 px-4 pb-1 pt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="relative flex items-center">
            {showScrollLeft ? (
              <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r from-muted/30 to-transparent" />
            ) : null}
            {showScrollRight ? (
              <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l from-muted/30 to-transparent" />
            ) : null}

            <div className="w-full overflow-x-auto scrollbar-hide scroll-smooth">
              <Tabs.List
                ref={tabsListRef}
                className="relative flex min-h-[44px] min-w-max flex-row gap-1"
                aria-label="Training settings categories"
              >
                <div
                  className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                  style={{
                    left: `${underlineStyle.left}px`,
                    width: `${underlineStyle.width}px`,
                  }}
                />
                {trainingTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <Tabs.Trigger
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tab.id] = el
                      }}
                      value={tab.id}
                      className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 cursor-pointer touch-manipulation items-center gap-2 border-b-2 border-transparent px-3 py-2.5 pb-1 text-sm font-semibold whitespace-nowrap text-slate-600 transition-all duration-200 hover:text-indigo-600 data-[state=active]:text-indigo-800"
                      style={{ background: "none", boxShadow: "none", borderRadius: 0 }}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </Tabs.Trigger>
                  )
                })}
              </Tabs.List>
            </div>
          </div>
        </div>

        <div className="w-full min-w-0 pt-6">
          <Tabs.Content value="experience-types" className="outline-none m-0">
            <div className="w-full min-w-0">
              <ExperienceTypesConfig />
            </div>
          </Tabs.Content>

          <Tabs.Content value="training-programs" className="outline-none m-0">
            <div className="w-full min-w-0">
              <SyllabusConfig />
            </div>
          </Tabs.Content>

          <Tabs.Content value="lessons" className="outline-none m-0">
            <div className="w-full min-w-0">
              <LessonsTab />
            </div>
          </Tabs.Content>

          <Tabs.Content value="exams" className="outline-none m-0">
            <div className="w-full min-w-0">
              <ExamsConfig />
            </div>
          </Tabs.Content>

          <Tabs.Content value="certifications" className="outline-none m-0">
            <div className="w-full min-w-0">
              <EndorsementsConfig />
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  )
}
