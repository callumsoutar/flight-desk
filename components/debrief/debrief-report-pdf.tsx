import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatOrdinal } from "@/lib/utils"

const styles = StyleSheet.create({
  page: {
    padding: 44,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#18181b",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  logo: {
    maxWidth: 120,
    maxHeight: 40,
    marginBottom: 6,
    objectFit: "contain",
  },
  tenantName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
  },
  tag: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    letterSpacing: 1,
    textAlign: "right",
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: "#18181b",
  },
  subtitle: {
    fontSize: 9,
    color: "#52525b",
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  metaItem: {
    width: "25%",
    paddingRight: 8,
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 7,
    color: "#71717a",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  body: {
    fontSize: 9,
    lineHeight: 1.45,
    color: "#3f3f46",
  },
  twoCol: {
    flexDirection: "row",
    marginTop: 4,
  },
  col: {
    flex: 1,
    paddingRight: 14,
  },
  colLast: {
    flex: 1,
    paddingRight: 0,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  listName: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    flex: 1,
    paddingRight: 8,
  },
  listValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    fontSize: 7,
    color: "#a1a1aa",
    textAlign: "center",
  },
})

export type DebriefReportPdfExperienceRow = {
  name: string
  detail: string
  valueLabel: string
}

export type DebriefReportPdfProps = {
  tenantName: string
  logoUrl?: string | null
  lessonName: string
  sessionDate: string
  studentName: string
  instructorName: string
  aircraftRegistration: string
  flightTimeLabel: string
  outcomeLabel: string
  attemptLabel: string | null
  instructorComments: string
  lessonHighlights: string
  airmanship: string
  areasForImprovement: string
  focusNextLesson: string
  weatherConditions: string
  safetyConcerns: string
  flightExperiences: DebriefReportPdfExperienceRow[]
}

function SectionBlock({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  )
}

export default function DebriefReportPDF(props: DebriefReportPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {props.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop
              <Image src={props.logoUrl} style={styles.logo} />
            ) : null}
            <Text style={styles.tenantName}>{props.tenantName}</Text>
          </View>
          <View>
            <Text style={styles.tag}>FLIGHT DEBRIEF</Text>
          </View>
        </View>

        <Text style={styles.title}>{props.lessonName}</Text>
        <Text style={styles.subtitle}>{props.sessionDate}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Student</Text>
            <Text style={styles.metaValue}>{props.studentName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Instructor</Text>
            <Text style={styles.metaValue}>{props.instructorName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Aircraft</Text>
            <Text style={styles.metaValue}>{props.aircraftRegistration}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Flight time</Text>
            <Text style={styles.metaValue}>{props.flightTimeLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Outcome</Text>
            <Text style={styles.metaValue}>{props.outcomeLabel}</Text>
          </View>
          {props.attemptLabel ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Attempt</Text>
              <Text style={styles.metaValue}>{props.attemptLabel}</Text>
            </View>
          ) : null}
        </View>

        <SectionBlock title="Instructor feedback" text={props.instructorComments} />

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <SectionBlock title="Lesson highlights" text={props.lessonHighlights} />
            <SectionBlock title="General airmanship" text={props.airmanship} />
          </View>
          <View style={styles.colLast}>
            <SectionBlock title="Areas for improvement" text={props.areasForImprovement} />
            <SectionBlock title="Focus for next lesson" text={props.focusNextLesson} />
          </View>
        </View>

        {props.weatherConditions.trim() || props.safetyConcerns.trim() ? (
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <SectionBlock title="Weather" text={props.weatherConditions} />
            </View>
            <View style={styles.colLast}>
              <SectionBlock title="Safety observations" text={props.safetyConcerns} />
            </View>
          </View>
        ) : null}

        {props.flightExperiences.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Flight experience logged</Text>
            {props.flightExperiences.map((row, i) => (
              <View key={i} style={styles.listRow} wrap={false}>
                <Text style={styles.listName}>
                  {row.name}
                  {row.detail ? ` — ${row.detail}` : ""}
                </Text>
                <Text style={styles.listValue}>{row.valueLabel}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Flight debrief report · {props.tenantName}
        </Text>
      </Page>
    </Document>
  )
}

export function formatAttemptLabel(attempt: number | null | undefined): string | null {
  if (attempt == null || !Number.isFinite(attempt)) return null
  return formatOrdinal(attempt)
}
