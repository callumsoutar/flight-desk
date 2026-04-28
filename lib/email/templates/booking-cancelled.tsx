import {
  Body,
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

export type BookingCancelledEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  bookingId: string
  startTime: string
  endTime: string
  timezone: string
  aircraftRegistration?: string | null
  cancellationReason: string
  cancelledNotes?: string | null
  contactEmail?: string | null
  unsubscribeUrl?: string | null
}

export function BookingCancelledEmail(props: BookingCancelledEmailProps) {
  const when = formatBookingDateRange(props.startTime, props.endTime, props.timezone)
  const firstName = props.memberFirstName.trim() || "there"

  return (
    <Html lang="en">
      <Head />
      <Preview>{`Booking cancelled - ${when.date}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.wrap}>
          {/* Header Section */}
          <Section style={styles.header}>
            <Row style={styles.headerRow}>
              <Column style={styles.headerColLeft}>
                <Text style={styles.headerTitle}>{props.tenantName}</Text>
              </Column>
              <Column style={styles.headerColRight}>
                <Text style={styles.headerTag}>Booking Cancelled</Text>
                <Text style={styles.headerDate}>{when.date}</Text>
              </Column>
            </Row>
          </Section>

          {/* Main Content Card */}
          <Section style={styles.card}>
            <Section style={styles.contentPadding}>
              <Heading style={styles.mainHeading}>Booking Cancelled</Heading>
              <Text style={styles.heroSub}>
                {`Hi ${firstName}, your booking at ${props.tenantName} has been cancelled.`}
              </Text>
              
              {/* Cancellation Details Card */}
              <Section style={styles.detailsCard}>
                <Section style={styles.detailsSection}>
                  <Text style={styles.detailsLabel}>Date & Time</Text>
                  <Text style={styles.detailsValueLarge}>{when.date}</Text>
                  <Text style={styles.detailsValueSmall}>{`${when.startTime} - ${when.endTime}`}</Text>
                </Section>

                <Section style={styles.divider} />

                {props.aircraftRegistration && (
                  <>
                    <Section style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Aircraft</Text>
                      <Text style={styles.detailsValueLarge}>{props.aircraftRegistration}</Text>
                    </Section>
                    <Section style={styles.divider} />
                  </>
                )}

                <Section style={styles.detailsSection}>
                  <Text style={styles.detailsLabel}>Reason for cancellation</Text>
                  <Text style={styles.detailsValueMedium}>{props.cancellationReason}</Text>
                </Section>

                {props.cancelledNotes && (
                  <>
                    <Section style={styles.divider} />
                    <Section style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Cancellation Notes</Text>
                      <Text style={styles.detailsValueSmall}>{props.cancelledNotes}</Text>
                    </Section>
                  </>
                )}
              </Section>

              {/* Info Box for Contact */}
              {props.contactEmail && (
                <Section style={styles.infoBox}>
                  <Row>
                    <Column style={styles.infoBoxIconCol}>
                      <div style={styles.infoBoxIcon}>
                        <Text style={styles.infoBoxIconText}>?</Text>
                      </div>
                    </Column>
                    <Column style={styles.infoBoxTextCol}>
                      <Text style={styles.infoBoxTitle}>Questions?</Text>
                      <Text style={styles.infoBoxContent}>
                        If you have any questions about this cancellation, please contact us at {props.contactEmail}.
                      </Text>
                    </Column>
                  </Row>
                </Section>
              )}
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
              This is a notification from {props.tenantName}
            </Text>
            <Text style={styles.footerAddress}>
              Powered by FlightDesk
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
    color: "#b91c1c",
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
  infoBox: {
    backgroundColor: "#fef2f2",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "32px",
  },
  infoBoxIconCol: {
    width: "48px",
    verticalAlign: "top",
  },
  infoBoxIcon: {
    width: "32px",
    height: "32px",
    backgroundColor: "#b91c1c",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBoxIconText: {
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "bold",
    margin: 0,
    textAlign: "center" as const,
    width: "100%",
  },
  infoBoxTextCol: {
    verticalAlign: "top",
  },
  infoBoxTitle: {
    color: "#b91c1c",
    fontSize: "16px",
    fontWeight: 600,
    margin: "0 0 8px 0",
  },
  infoBoxContent: {
    color: "#7f1d1d",
    fontSize: "15px",
    lineHeight: "24px",
    margin: 0,
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
