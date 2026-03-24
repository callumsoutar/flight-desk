import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

import { formatBookingDateRange } from "@/lib/email/format-booking-time"
import type { BookingUpdatedChange } from "@/lib/email/build-booking-updated-changes"

export type BookingUpdatedEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  bookingId: string
  startTime: string
  endTime: string
  timezone: string
  bookingUrl: string
  changes: BookingUpdatedChange[]
  aircraftDisplay?: string | null
  flightType?: string | null
  lessonName?: string | null
  instructorName?: string | null
  purpose?: string | null
  description?: string | null
  bookingsUrl?: string | null
  trainingLogUrl?: string | null
  unsubscribeUrl?: string | null
}

function formatDurationHours(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const hours = (end - start) / 3_600_000
  if (!Number.isFinite(hours) || hours <= 0) return "-"
  if (Math.abs(hours - Math.round(hours)) < 0.01) return `${Math.round(hours)} hrs`
  return `${hours.toFixed(1)} hrs`
}

function infoRow(icon: string, label: string, value: string) {
  return (
    <Section style={styles.infoRow}>
      <Row>
        <Column style={styles.infoIconCol}>
          <Text style={styles.infoIcon}>{icon}</Text>
        </Column>
        <Column style={styles.infoTextCol}>
          <Row>
            <Column style={styles.infoLabelCol}>
              <Text style={styles.infoLabel}>{label}</Text>
            </Column>
            <Column style={styles.infoValueCol}>
              <Text style={styles.infoValue}>{value}</Text>
            </Column>
          </Row>
        </Column>
      </Row>
    </Section>
  )
}

function changeRow(change: BookingUpdatedChange) {
  return (
    <Section style={styles.changeCard}>
      <Text style={styles.changeLabel}>{change.label}</Text>
      <Text style={styles.changeValues}>
        <span style={styles.changeBefore}>{change.before}</span>
        <span style={styles.changeArrow}>{"  ->  "}</span>
        <span style={styles.changeAfter}>{change.after}</span>
      </Text>
    </Section>
  )
}

export function BookingUpdatedEmail(props: BookingUpdatedEmailProps) {
  const when = formatBookingDateRange(props.startTime, props.endTime, props.timezone)
  const duration = formatDurationHours(props.startTime, props.endTime)
  const firstName = props.memberFirstName.trim() || "there"
  const keyPurpose = props.purpose?.trim() || "Not set"
  const keyLesson = props.lessonName?.trim() || "Unassigned"
  const keyAircraft = props.aircraftDisplay?.trim() || "Unassigned"
  const keyInstructor = props.instructorName?.trim() || "Unassigned"
  const keyFlightType = props.flightType?.trim() || "Not set"

  return (
    <Html lang="en">
      <Head />
      <Preview>{`Booking updated - ${when.full}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.wrap}>
          <Section style={styles.header}>
            <Row>
              <Column style={styles.headerColLeft}>
                <Text style={styles.headerTitle}>{props.tenantName}</Text>
              </Column>
              <Column style={styles.headerColRight}>
                <Text style={styles.headerTag}>Booking Updated</Text>
                <Text style={styles.headerDate}>{when.date}</Text>
              </Column>
            </Row>
          </Section>

          <Section style={styles.card}>
            <Section style={styles.hero}>
              <Text style={styles.statusText}>Booking updated</Text>
              <Heading style={styles.heroHeading}>{`Your booking details changed, ${firstName}.`}</Heading>
              <Text style={styles.heroSub}>
                {`We updated this booking at ${props.tenantName}. Review the changes and current details below.`}
              </Text>

              <Section style={styles.timeStrip}>
                <Row style={styles.timeStripRow}>
                  <Column style={styles.timeColLeft}>
                    <Text style={styles.timeLbl}>Depart</Text>
                    <Text style={styles.timeVal}>{when.startTime}</Text>
                  </Column>
                  <Column style={styles.timeColMid}>
                    <Text style={styles.durationPill}>{duration}</Text>
                  </Column>
                  <Column style={styles.timeColRight}>
                    <Text style={styles.timeLbl}>Return</Text>
                    <Text style={styles.timeVal}>{when.endTime}</Text>
                  </Column>
                </Row>
              </Section>
            </Section>

            <Section style={styles.section}>
              <Text style={styles.sectionLabel}>Changes made</Text>
              {props.changes.map((change) => (
                <React.Fragment key={`${change.label}-${change.before}-${change.after}`}>
                  {changeRow(change)}
                </React.Fragment>
              ))}
            </Section>

            <Section style={styles.section}>
              <Text style={styles.sectionLabel}>Current booking details</Text>
              {infoRow("📅", "Date", when.date)}
              {infoRow("✈️", "Aircraft", keyAircraft)}
              {infoRow("👤", "Instructor", keyInstructor)}
              {infoRow("🛩️", "Flight type", keyFlightType)}
              {infoRow("📘", "Lesson", keyLesson)}
              {infoRow("📋", "Purpose", keyPurpose)}
            </Section>

            <Section style={styles.ctaSection}>
              <Button href={props.bookingUrl} style={styles.ctaBtn}>
                View booking in FlightDesk
              </Button>
              <Text style={styles.ctaNote}>Reference: {props.bookingId}</Text>
            </Section>
          </Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>{`${props.tenantName} - Powered by FlightDesk Pro`}</Text>
            <Text style={styles.footerText}>
              Sent by FlightDesk Pro on behalf of {props.tenantName}.
            </Text>
            <Section style={styles.footerLinks}>
              {props.bookingsUrl ? <Link href={props.bookingsUrl}>My bookings</Link> : null}
              {props.trainingLogUrl ? <Link href={props.trainingLogUrl}>Training log</Link> : null}
              {props.unsubscribeUrl ? <Link href={props.unsubscribeUrl}>Unsubscribe</Link> : null}
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#edf0f3",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#111827",
    padding: "40px 16px 60px",
  },
  wrap: {
    maxWidth: "540px",
    margin: "0 auto",
  },
  header: {
    backgroundColor: "#17223b",
    borderRadius: "12px 12px 0 0",
    padding: "22px 24px 20px",
  },
  headerColLeft: {
    width: "56%",
    verticalAlign: "top",
    paddingRight: "12px",
  },
  headerColRight: {
    width: "44%",
    verticalAlign: "top",
    textAlign: "right",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.25,
    margin: "2px 0 0",
  },
  headerTag: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(255,255,255,0.28)",
    borderRadius: "999px",
    padding: "5px 12px",
    margin: "0 0 10px",
    display: "inline-block",
  },
  headerDate: {
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    lineHeight: 1.4,
    margin: 0,
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    overflow: "hidden",
  },
  hero: {
    padding: "28px 24px 24px",
    borderBottom: "1px solid #f3f4f6",
  },
  statusText: {
    color: "#6b7280",
    fontSize: "12px",
    margin: 0,
  },
  heroHeading: {
    color: "#111827",
    fontSize: "22px",
    margin: "10px 0 6px",
    lineHeight: 1.3,
  },
  heroSub: {
    color: "#6b7280",
    fontSize: "13.5px",
    lineHeight: 1.5,
    margin: 0,
  },
  timeStrip: {
    marginTop: "18px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    backgroundColor: "#f9fafb",
    padding: "16px 14px",
  },
  timeStripRow: {
    verticalAlign: "middle",
  },
  timeColLeft: {
    width: "32%",
    verticalAlign: "middle",
    paddingRight: "8px",
  },
  timeColMid: {
    width: "36%",
    verticalAlign: "middle",
    textAlign: "center",
    padding: "0 6px",
  },
  timeColRight: {
    width: "32%",
    verticalAlign: "middle",
    textAlign: "right",
    paddingLeft: "8px",
  },
  durationPill: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "999px",
    padding: "8px 14px",
    margin: "0",
    color: "#4b5563",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: "center",
    display: "inline-block",
  },
  timeVal: {
    fontSize: "24px",
    color: "#111827",
    fontWeight: 700,
    lineHeight: 1.15,
    margin: "6px 0 0",
    letterSpacing: "-0.02em",
  },
  timeLbl: {
    fontSize: "10px",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin: 0,
    fontWeight: 600,
  },
  section: {
    padding: "20px 24px",
    borderBottom: "1px solid #f3f4f6",
  },
  sectionLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: "0.08em",
    margin: "0 0 12px",
  },
  infoRow: {
    borderBottom: "1px solid #f3f4f6",
    padding: "10px 0",
  },
  infoIconCol: {
    width: "36px",
    verticalAlign: "middle",
    paddingRight: "4px",
  },
  infoIcon: {
    fontSize: "16px",
    lineHeight: "20px",
    margin: 0,
  },
  infoTextCol: {
    width: "auto",
    verticalAlign: "middle",
  },
  infoLabelCol: {
    width: "42%",
    verticalAlign: "middle",
  },
  infoValueCol: {
    width: "58%",
    verticalAlign: "middle",
    textAlign: "right",
  },
  infoLabel: {
    color: "#9ca3af",
    fontSize: "13px",
    margin: 0,
    lineHeight: 1.4,
  },
  infoValue: {
    color: "#111827",
    fontSize: "13px",
    fontWeight: 500,
    margin: 0,
    lineHeight: 1.4,
  },
  changeCard: {
    border: "1px solid #fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: "10px",
    padding: "10px 12px",
    marginBottom: "10px",
  },
  changeLabel: {
    color: "#9f1239",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0 0 6px",
  },
  changeValues: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.4,
  },
  changeBefore: {
    color: "#9ca3af",
    textDecoration: "line-through",
  },
  changeArrow: {
    color: "#6b7280",
    fontWeight: 600,
  },
  changeAfter: {
    color: "#15803d",
    fontWeight: 700,
  },
  ctaSection: {
    padding: "22px 24px 24px",
  },
  ctaBtn: {
    display: "block",
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    textAlign: "center",
    fontSize: "13.5px",
    fontWeight: 600,
    padding: "12px 20px",
    borderRadius: "8px",
    textDecoration: "none",
  },
  ctaNote: {
    fontSize: "12px",
    color: "#9ca3af",
    textAlign: "center",
    margin: "10px 0 0",
    lineHeight: 1.5,
  },
  footer: {
    marginTop: "18px",
    textAlign: "center",
  },
  footerText: {
    color: "#9ca3af",
    fontSize: "11.5px",
    lineHeight: 1.6,
    margin: "0 0 4px",
  },
  footerLinks: {
    marginTop: "6px",
  },
}
