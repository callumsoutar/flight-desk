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

function changeRow(change: BookingUpdatedChange) {
  return (
    <Section style={styles.changeCard}>
      <Text style={styles.changeLabel}>{change.label}</Text>
      <Text style={styles.changeValues}>
        <span style={styles.changeBefore}>{change.before}</span>
        <span style={styles.changeArrow}>{"  →  "}</span>
        <span style={styles.changeAfter}>{change.after}</span>
      </Text>
    </Section>
  )
}

export function BookingUpdatedEmail(props: BookingUpdatedEmailProps) {
  const when = formatBookingDateRange(props.startTime, props.endTime, props.timezone)
  const aircraftLine = props.aircraftDisplay ?? null

  return (
    <Html lang="en">
      <Head />
      <Preview>{`Booking updated - ${when.full}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.wrap}>
          {/* Header Section */}
          <Section style={styles.header}>
            <Row style={styles.headerRow}>
              <Column style={styles.headerColLeft}>
                <Text style={styles.headerTitle}>{props.tenantName}</Text>
              </Column>
              <Column style={styles.headerColRight}>
                <Text style={styles.headerTag}>Booking Updated</Text>
                <Text style={styles.headerDate}>{when.date}</Text>
              </Column>
            </Row>
          </Section>

          {/* Main Content Card */}
          <Section style={styles.card}>
            <Section style={styles.contentPadding}>
              <Heading style={styles.mainHeading}>Your booking details changed</Heading>
              <Text style={styles.heroSub}>
                {`We updated this booking at ${props.tenantName}. Review the changes and current details below.`}
              </Text>

              {/* Changes Section */}
              <Section style={styles.changesSection}>
                <Text style={styles.sectionLabel}>Changes made</Text>
                {props.changes.map((change) => (
                  <React.Fragment key={`${change.label}-${change.before}-${change.after}`}>
                    {changeRow(change)}
                  </React.Fragment>
                ))}
              </Section>
              
              {/* Booking Details Card */}
              <Section style={styles.detailsCard}>
                <Text style={styles.sectionLabel}>Current booking details</Text>
                <Section style={styles.detailsSection}>
                  <Text style={styles.detailsLabel}>Date & Time</Text>
                  <Text style={styles.detailsValueLarge}>{when.date}</Text>
                  <Text style={styles.detailsValueSmall}>{`${when.startTime} - ${when.endTime}`}</Text>
                </Section>

                <Section style={styles.divider} />

                {aircraftLine && (
                  <>
                    <Section style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Aircraft</Text>
                      <Text style={styles.detailsValueLarge}>{aircraftLine}</Text>
                    </Section>
                    <Section style={styles.divider} />
                  </>
                )}

                {props.instructorName && (
                  <>
                    <Section style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Instructor</Text>
                      <Text style={styles.detailsValueMedium}>{props.instructorName}</Text>
                    </Section>
                    <Section style={styles.divider} />
                  </>
                )}

                {props.flightType && (
                  <>
                    <Section style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Flight Type</Text>
                      <Text style={styles.detailsValueMedium}>{props.flightType}</Text>
                    </Section>
                    <Section style={styles.divider} />
                  </>
                )}

                {props.lessonName && (
                  <>
                    <Section style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Lesson</Text>
                      <Text style={styles.detailsValueMedium}>{props.lessonName}</Text>
                    </Section>
                    <Section style={styles.divider} />
                  </>
                )}

                {props.description && (
                  <>
                    <Section style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Description</Text>
                      <Text style={styles.detailsValueSmall}>{props.description}</Text>
                    </Section>
                    <Section style={styles.divider} />
                  </>
                )}

                <Section style={styles.detailsSection}>
                  <Text style={styles.detailsLabel}>Purpose</Text>
                  <Text style={styles.detailsValueMedium}>{props.purpose || "Not set"}</Text>
                </Section>
              </Section>

              {/* CTA Button */}
              <Section style={styles.ctaWrapper}>
                <Button href={props.bookingUrl} style={styles.ctaBtn}>
                  View booking details
                </Button>
              </Section>

              {/* Help Link */}
              <Section style={styles.helpSection}>
                <Text style={styles.helpText}>Need to make changes?</Text>
                <Link href={props.bookingUrl} style={styles.helpLink}>
                  Manage your booking →
                </Link>
              </Section>
            </Section>
          </Section>

          {/* Footer Section */}
          <Section style={styles.footer}>
            <Section style={styles.footerLinks}>
              <Link href="#" style={styles.footerLink}>Help Center</Link>
              <Link href="#" style={styles.footerLink}>Terms</Link>
              <Link href="#" style={styles.footerLink}>Community</Link>
            </Section>
            
            <Text style={styles.footerCopyright}>
              This is a confirmation email from {props.tenantName}
            </Text>
            <Text style={styles.footerAddress}>
              Powered by FlightDesk Pro
            </Text>
            {props.unsubscribeUrl && (
              <Link href={props.unsubscribeUrl} style={styles.unsubscribeLink}>
                Unsubscribe
              </Link>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#eeeeee",
    fontFamily: "'Uber Move', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    margin: 0,
    padding: 0,
  },
  wrap: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#17223b",
    padding: "40px 32px",
    borderTopLeftRadius: "16px",
    borderTopRightRadius: "16px",
  },
  headerRow: {
    verticalAlign: "middle",
  },
  headerColLeft: {
    width: "56%",
    verticalAlign: "middle",
    paddingRight: "12px",
  },
  headerColRight: {
    width: "44%",
    verticalAlign: "middle",
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
  },
  contentPadding: {
    padding: "48px 40px 40px 40px",
  },
  mainHeading: {
    margin: "0 0 16px 0",
    color: "#000000",
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.3px",
  },
  heroSub: {
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: 1.5,
    margin: "0 0 32px 0",
  },
  changesSection: {
    marginBottom: "32px",
  },
  sectionLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: "0.08em",
    margin: "0 0 12px",
  },
  changeCard: {
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: "10px",
    padding: "12px 16px",
    marginBottom: "12px",
  },
  changeLabel: {
    color: "#4b5563",
    fontSize: "11px",
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
    margin: "0 8px",
  },
  changeAfter: {
    color: "#15803d",
    fontWeight: 700,
  },
  detailsCard: {
    backgroundColor: "#f6f6f6",
    borderRadius: "12px",
    marginBottom: "32px",
    padding: "28px",
  },
  detailsSection: {
    marginBottom: "0",
  },
  detailsLabel: {
    color: "#6b6b6b",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 10px 0",
  },
  detailsValueLarge: {
    color: "#000000",
    fontSize: "20px",
    fontWeight: 600,
    margin: "0 0 4px 0",
    letterSpacing: "-0.3px",
  },
  detailsValueMedium: {
    color: "#000000",
    fontSize: "17px",
    fontWeight: 500,
    margin: 0,
  },
  detailsValueSmall: {
    color: "#545454",
    fontSize: "15px",
    fontWeight: 400,
    margin: 0,
  },
  divider: {
    height: "1px",
    backgroundColor: "#e0e0e0",
    margin: "24px 0",
  },
  ctaWrapper: {
    marginBottom: "32px",
  },
  ctaBtn: {
    display: "block",
    padding: "18px 32px",
    backgroundColor: "#000000",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "8px",
    fontSize: "17px",
    fontWeight: 600,
    textAlign: "center" as const,
    letterSpacing: "-0.2px",
  },
  helpSection: {
    textAlign: "center" as const,
    padding: "20px 0",
  },
  helpText: {
    color: "#545454",
    fontSize: "15px",
    margin: "0 0 8px 0",
  },
  helpLink: {
    color: "#000000",
    fontSize: "16px",
    fontWeight: 600,
    textDecoration: "none",
  },
  footer: {
    padding: "40px",
    backgroundColor: "#000000",
    textAlign: "center" as const,
  },
  footerLinks: {
    marginBottom: "24px",
  },
  footerLink: {
    color: "#ffffff",
    fontSize: "14px",
    textDecoration: "none",
    margin: "0 10px",
    opacity: 0.8,
  },
  footerCopyright: {
    color: "#999999",
    fontSize: "12px",
    lineHeight: "20px",
    margin: "0 0 4px 0",
  },
  footerAddress: {
    color: "#999999",
    fontSize: "12px",
    lineHeight: "20px",
    margin: "0 0 8px 0",
  },
  unsubscribeLink: {
    color: "#999999",
    fontSize: "12px",
    textDecoration: "none",
  },
}
