import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingRight: 36,
    paddingBottom: 42,
    paddingLeft: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  article: {
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 16,
    marginBottom: 12,
  },
  logoWrap: {
    marginBottom: 12,
  },
  logo: {
    maxWidth: 132,
    maxHeight: 28,
    objectFit: "contain",
  },
  reportLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontSize: 23,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#18181b",
  },
  subtitle: {
    fontSize: 11,
    color: "#52525b",
    lineHeight: 1.5,
  },
  metaTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
  },
  metaTopItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
    marginBottom: 4,
  },
  metaInlineLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginRight: 6,
  },
  metaInlineValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
  },
  metaInlineValuePass: {
    color: "#047857",
  },
  metaInlineValueFail: {
    color: "#be123c",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 12,
    marginBottom: 14,
  },
  detailItem: {
    width: "25%",
    paddingRight: 14,
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
  },
  sectionStack: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  body: {
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#18181b",
  },
  bodyMuted: {
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#3f3f46",
  },
  bodyStrong: {
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#0f172a",
    fontFamily: "Helvetica-Bold",
  },
  placeholder: {
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#71717a",
    fontStyle: "italic",
  },
  paragraph: {
    marginBottom: 6,
  },
  twoColumn: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  column: {
    width: "47.5%",
  },
  block: {
    marginBottom: 16,
  },
  blockLast: {
    marginBottom: 0,
  },
  listSection: {
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    paddingTop: 14,
    marginTop: 2,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  listRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  listText: {
    flex: 1,
    paddingRight: 14,
  },
  listName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  listDetail: {
    fontSize: 9.5,
    color: "#71717a",
    lineHeight: 1.45,
  },
  listValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    fontSize: 8,
    color: "#a1a1aa",
    textAlign: "left",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
    paddingTop: 8,
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

function BodyText({
  text,
  placeholder,
  style = styles.body,
}: {
  text: string
  placeholder: string
  style?: typeof styles.body
}) {
  const trimmed = text.trim()
  if (!trimmed) return <Text style={styles.placeholder}>{placeholder}</Text>

  const paragraphs = trimmed.split(/\n{2,}/).filter(Boolean)
  return (
    <View>
      {paragraphs.map((paragraph, index) => (
        <Text
          key={index}
          style={index < paragraphs.length - 1 ? [style, styles.paragraph] : style}
        >
          {paragraph}
        </Text>
      ))}
    </View>
  )
}

function SectionCard({
  title,
  text,
  placeholder,
  style,
}: {
  title: string
  text: string
  placeholder: string
  style?: typeof styles.body
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <BodyText text={text} placeholder={placeholder} style={style} />
    </View>
  )
}

export default function DebriefReportPDF(props: DebriefReportPdfProps) {
  const outcomeStyle =
    props.outcomeLabel === "Pass"
      ? [styles.metaInlineValue, styles.metaInlineValuePass]
      : props.outcomeLabel === "Not Yet Competent"
        ? [styles.metaInlineValue, styles.metaInlineValueFail]
        : styles.metaInlineValue

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.article}>
          <View style={styles.header}>
            {props.logoUrl ? (
              <View style={styles.logoWrap}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
                <Image src={props.logoUrl} style={styles.logo} />
              </View>
            ) : null}
            <Text style={styles.reportLabel}>Flight Debrief Report</Text>
            <View>
              <Text style={styles.title}>{props.lessonName}</Text>
              <Text style={styles.subtitle}>{props.sessionDate}</Text>
            </View>
          </View>

          <View style={styles.metaTopRow}>
            <View style={styles.metaTopItem}>
              <Text style={styles.metaInlineLabel}>Outcome</Text>
              <Text style={outcomeStyle}>{props.outcomeLabel}</Text>
            </View>
            {props.attemptLabel ? (
              <View style={styles.metaTopItem}>
                <Text style={styles.metaInlineLabel}>Attempt</Text>
                <Text style={styles.metaInlineValue}>{props.attemptLabel}</Text>
              </View>
            ) : null}
            <View style={styles.metaTopItem}>
              <Text style={styles.metaInlineLabel}>Flight Time</Text>
              <Text style={styles.metaInlineValue}>{props.flightTimeLabel}</Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Student</Text>
              <Text style={styles.detailValue}>{props.studentName}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Instructor</Text>
              <Text style={styles.detailValue}>{props.instructorName}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Aircraft</Text>
              <Text style={styles.detailValue}>{props.aircraftRegistration}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Session</Text>
              <Text style={styles.detailValue}>{props.sessionDate}</Text>
            </View>
          </View>

          <View style={styles.sectionStack}>
            <Text style={styles.sectionTitle}>Instructor Feedback</Text>
            <BodyText
              text={props.instructorComments}
              placeholder="No instructor feedback recorded."
              style={styles.body}
            />
          </View>

          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <SectionCard
                title="Lesson Highlights"
                text={props.lessonHighlights}
                placeholder="No highlights recorded."
                style={styles.bodyMuted}
              />
              <View style={styles.blockLast}>
                <Text style={styles.sectionTitle}>General Airmanship</Text>
                <BodyText
                  text={props.airmanship}
                  placeholder="No airmanship notes recorded."
                  style={styles.bodyMuted}
                />
              </View>
            </View>

            <View style={styles.column}>
              <SectionCard
                title="Areas for Improvement"
                text={props.areasForImprovement}
                placeholder="No areas for improvement recorded."
                style={styles.bodyMuted}
              />
              <View style={styles.blockLast}>
                <Text style={styles.sectionTitle}>Focus for Next Lesson</Text>
                <BodyText
                  text={props.focusNextLesson}
                  placeholder="Standard progress to next lesson."
                  style={styles.bodyStrong}
                />
              </View>
            </View>
          </View>

          {props.weatherConditions.trim() || props.safetyConcerns.trim() ? (
            <View style={styles.twoColumn}>
              <View style={styles.column}>
                <View style={styles.blockLast}>
                  <Text style={styles.sectionTitle}>Weather</Text>
                  <BodyText
                    text={props.weatherConditions}
                    placeholder="-"
                    style={styles.body}
                  />
                </View>
              </View>
              <View style={styles.column}>
                <View style={styles.blockLast}>
                  <Text style={styles.sectionTitle}>Safety Observations</Text>
                  <BodyText
                    text={props.safetyConcerns}
                    placeholder="-"
                    style={styles.body}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {props.flightExperiences.length > 0 ? (
            <View style={styles.listSection}>
              <Text style={styles.sectionTitle}>Flight Experience Logged</Text>
              {props.flightExperiences.map((row, index) => (
                <View
                  key={`${row.name}-${index}`}
                  style={
                    index === props.flightExperiences.length - 1
                      ? [styles.listRow, styles.listRowLast]
                      : styles.listRow
                  }
                  wrap={false}
                >
                  <View style={styles.listText}>
                    <Text style={styles.listName}>{row.name}</Text>
                    {row.detail ? <Text style={styles.listDetail}>{row.detail}</Text> : null}
                  </View>
                  <Text style={styles.listValue}>{row.valueLabel}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text>Flight debrief report · {props.tenantName}</Text>
            <Text
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  )
}
