import {
  Body,
  Column,
  Container,
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
import { BookingEmailHead } from "@/lib/email/templates/booking-email-theme"

export type BookingConfirmedEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  bookingId: string
  startTime: string
  endTime: string
  timezone: string
  aircraftRegistration?: string | null
  aircraftType?: string | null
  instructorName?: string | null
  purpose: string
  bookingUrl: string
  aircraftDisplay?: string | null
  flightType?: string | null
  lessonName?: string | null
  remarks?: string | null
  briefingAt?: string | null
  aerodrome?: string | null
  policyNote?: string | null
  bookingsUrl?: string | null
  trainingLogUrl?: string | null
  unsubscribeUrl?: string | null
}

export function BookingConfirmedEmail(props: BookingConfirmedEmailProps) {
  const when = formatBookingDateRange(props.startTime, props.endTime, props.timezone)
  const aircraftLine = props.aircraftDisplay ?? props.aircraftRegistration ?? null
  const aircraftTypeShown = props.aircraftType?.trim() ?? ""
  const showAircraftSection = Boolean(aircraftLine || aircraftTypeShown)
  const regMismatch =
    Boolean(
      props.aircraftDisplay?.trim() &&
        props.aircraftRegistration?.trim() &&
        props.aircraftDisplay.trim() !== props.aircraftRegistration.trim()
    )
  const firstName = props.memberFirstName.trim() || "there"
  const footerLinks = [
    { href: props.bookingUrl, label: "Manage booking" },
    props.bookingsUrl ? { href: props.bookingsUrl, label: "All bookings" } : null,
    props.trainingLogUrl ? { href: props.trainingLogUrl, label: "Training log" } : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link))

  return (
    <Html lang="en">
      <BookingEmailHead />
      <Preview>{`Booking confirmed - ${when.full}`}</Preview>
      <Body className="email-body" style={styles.body}>
        <Container className="email-wrap" style={styles.wrap}>
          <Section className="email-frame" style={styles.frame}>
            <Section className="email-header" style={styles.header}>
              <Row style={styles.headerRow}>
                <Column style={styles.headerColLeft}>
                  <Text className="email-header-title" style={styles.headerTitle}>{props.tenantName}</Text>
                </Column>
                <Column style={styles.headerColRight}>
                  <Text className="email-tag" style={styles.headerTag}>Booking Confirmed</Text>
                  <Text className="email-header-date" style={styles.headerDate}>{when.date}</Text>
                </Column>
              </Row>
            </Section>

            <Section className="email-card" style={styles.card}>
              <Section style={styles.contentPadding}>
                <Heading className="email-heading" style={styles.mainHeading}>Your flight is confirmed</Heading>
                <Text className="email-copy" style={styles.heroSub}>
                  {`Hi ${firstName}, your booking at ${props.tenantName} is locked in. Here are the current details.`}
                </Text>

                <Section className="email-panel" style={styles.detailsCard}>
                  <Section style={styles.detailsSection}>
                    <Text className="email-label" style={styles.detailsLabel}>Date & Time</Text>
                    <Text className="email-value-strong" style={styles.detailsValueLarge}>{when.date}</Text>
                    <Text className="email-value" style={styles.detailsValueSmall}>{`${when.startTime} - ${when.endTime}`}</Text>
                  </Section>

                  <Section className="email-divider" style={styles.divider} />

                  {showAircraftSection && (
                    <>
                      <Section style={styles.detailsSection}>
                        <Text className="email-label" style={styles.detailsLabel}>Aircraft</Text>
                        {aircraftLine && (
                          <Text className="email-value-strong" style={styles.detailsValueLarge}>{aircraftLine}</Text>
                        )}
                        {aircraftTypeShown && (
                          <Text className="email-value" style={styles.detailsValueSmall}>Type: {aircraftTypeShown}</Text>
                        )}
                        {regMismatch && (
                          <Text className="email-value" style={styles.detailsValueSmall}>
                            Registration: {props.aircraftRegistration}
                          </Text>
                        )}
                      </Section>
                      <Section className="email-divider" style={styles.divider} />
                    </>
                  )}

                  <Section style={styles.detailsSection}>
                    <Text className="email-label" style={styles.detailsLabel}>Booking description</Text>
                    <Text className="email-value-strong" style={styles.detailsValueMedium}>{props.purpose}</Text>
                  </Section>

                  {(props.remarks?.trim() || props.flightType || props.lessonName) && (
                    <Section className="email-divider" style={styles.divider} />
                  )}

                  {props.remarks?.trim() && (
                    <>
                      <Section style={styles.detailsSection}>
                        <Text className="email-label" style={styles.detailsLabel}>Remarks</Text>
                        <Text className="email-value" style={styles.detailsValueSmall}>{props.remarks.trim()}</Text>
                      </Section>
                      {(props.flightType || props.lessonName) && (
                        <Section className="email-divider" style={styles.divider} />
                      )}
                    </>
                  )}

                  {props.flightType && (
                    <>
                      <Section style={styles.detailsSection}>
                        <Text className="email-label" style={styles.detailsLabel}>Flight Type</Text>
                        <Text className="email-value-strong" style={styles.detailsValueMedium}>{props.flightType}</Text>
                      </Section>
                      {props.lessonName && <Section className="email-divider" style={styles.divider} />}
                    </>
                  )}

                  {props.lessonName && (
                    <Section style={styles.detailsSection}>
                      <Text className="email-label" style={styles.detailsLabel}>Lesson</Text>
                      <Text className="email-value-strong" style={styles.detailsValueMedium}>{props.lessonName}</Text>
                    </Section>
                  )}
                </Section>

                <Section style={styles.ctaWrapper}>
                  <Link href={props.bookingUrl} className="email-button email-button-text" style={styles.ctaBtn}>
                    View booking details
                  </Link>
                </Section>

                <Section style={styles.helpSection}>
                  <Text className="email-copy" style={styles.helpText}>Need to make changes?</Text>
                  <Link href={props.bookingUrl} className="email-help-link" style={styles.helpLink}>
                    Manage your booking →
                  </Link>
                </Section>
              </Section>
            </Section>

            <Section className="email-footer" style={styles.footer}>
              {footerLinks.length > 0 && (
                <Section style={styles.footerLinks}>
                  {footerLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="email-footer-link" style={styles.footerLink}>
                      {link.label}
                    </Link>
                  ))}
                </Section>
              )}

              <Text className="email-footer-copy" style={styles.footerCopyright}>
                Booking confirmation from {props.tenantName}
              </Text>
              <Text className="email-footer-copy" style={styles.footerAddress}>
                Powered by FlightDesk
              </Text>
              {props.unsubscribeUrl && (
                <Link href={props.unsubscribeUrl} className="email-footer-link" style={styles.unsubscribeLink}>
                  Unsubscribe
                </Link>
              )}
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#eceef1",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0,
  },
  wrap: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "24px 12px",
  },
  frame: {
    backgroundColor: "#ffffff",
    border: "1px solid #d7dbe2",
    borderRadius: "24px",
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#12161d",
    padding: "32px",
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
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: 1.25,
    margin: "2px 0 0",
  },
  headerTag: {
    fontSize: "11px",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: "6px 12px",
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
    padding: "40px 32px 32px 32px",
  },
  mainHeading: {
    margin: "0 0 12px 0",
    color: "#111111",
    fontSize: "32px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.6px",
  },
  heroSub: {
    color: "#5f636b",
    fontSize: "15px",
    lineHeight: 1.6,
    margin: "0 0 28px 0",
  },
  detailsCard: {
    backgroundColor: "#f5f6f7",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    marginBottom: "32px",
    padding: "28px",
  },
  detailsSection: {
    marginBottom: "0",
  },
  detailsLabel: {
    color: "#6b7280",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "0 0 10px 0",
  },
  detailsValueLarge: {
    color: "#111111",
    fontSize: "20px",
    fontWeight: 600,
    margin: "0 0 4px 0",
    letterSpacing: "-0.3px",
  },
  detailsValueMedium: {
    color: "#111111",
    fontSize: "17px",
    fontWeight: 600,
    margin: 0,
  },
  detailsValueSmall: {
    color: "#3f3f46",
    fontSize: "15px",
    fontWeight: 400,
    margin: 0,
  },
  divider: {
    height: "1px",
    backgroundColor: "#dfe3e8",
    margin: "24px 0",
  },
  ctaWrapper: {
    marginBottom: "32px",
  },
  ctaBtn: {
    display: "block",
    padding: "18px 32px",
    backgroundColor: "#161a22",
    color: "#ffffff",
    border: "1px solid #161a22",
    textDecoration: "none",
    borderRadius: "999px",
    fontSize: "16px",
    fontWeight: 600,
    textAlign: "center" as const,
    letterSpacing: "-0.2px",
  },
  helpSection: {
    textAlign: "center" as const,
    padding: "20px 0",
  },
  helpText: {
    color: "#5f636b",
    fontSize: "15px",
    margin: "0 0 8px 0",
  },
  helpLink: {
    color: "#111111",
    fontSize: "16px",
    fontWeight: 600,
    textDecoration: "none",
  },
  footer: {
    padding: "32px",
    backgroundColor: "#12161d",
    textAlign: "center" as const,
  },
  footerLinks: {
    marginBottom: "24px",
  },
  footerLink: {
    color: "#f5f5f5",
    fontSize: "14px",
    textDecoration: "none",
    margin: "0 10px",
  },
  footerCopyright: {
    color: "#9ca3af",
    fontSize: "12px",
    lineHeight: "20px",
    margin: "0 0 4px 0",
  },
  footerAddress: {
    color: "#9ca3af",
    fontSize: "12px",
    lineHeight: "20px",
    margin: "0 0 8px 0",
  },
  unsubscribeLink: {
    color: "#f5f5f5",
    fontSize: "12px",
    textDecoration: "none",
  },
}
