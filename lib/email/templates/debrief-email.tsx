import { Column, Heading, Hr, Row, Section, Text } from "@react-email/components"
import * as React from "react"

import { TemplateShell } from "./template-shell"

export type DebriefEmailProps = {
  tenantName: string
  logoUrl?: string | null
  memberFirstName: string
  lessonName: string
  sessionDate: string
  instructorName: string
  aircraftRegistration: string
  flightTimeLabel: string
  outcomeLabel: string
  attemptLabel?: string | null
  focusNextLessonPreview?: string | null
  contactEmail?: string | null
}

const labelStyle = {
  color: "#71717a",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  margin: "0 0 4px",
}

const valueStyle = {
  color: "#18181b",
  fontSize: "14px",
  margin: "0 0 14px",
  lineHeight: "1.45",
}

const summaryBox = {
  backgroundColor: "#fafafa",
  border: "1px solid #e4e4e7",
  borderRadius: "8px",
  padding: "16px 18px",
  marginBottom: "20px",
}

export function DebriefEmail(props: DebriefEmailProps) {
  const preview = `Your flight debrief — ${props.lessonName}`

  return (
    <TemplateShell preview={preview} tenantName={props.tenantName} logoUrl={props.logoUrl}>
      <Text style={{ color: "#71717a", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", margin: "0 0 8px" }}>
        FLIGHT DEBRIEF REPORT
      </Text>
      <Heading style={{ color: "#18181b", margin: "0 0 8px", fontSize: "22px", lineHeight: "1.25" }}>
        {props.lessonName}
      </Heading>
      <Text style={{ color: "#52525b", margin: "0 0 20px", fontSize: "14px" }}>{props.sessionDate}</Text>

      <Text style={{ color: "#18181b", margin: "0 0 16px", fontSize: "15px" }}>
        Hi {props.memberFirstName || "there"},
      </Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 18px", fontSize: "14px", lineHeight: "1.55" }}>
        Your instructor has shared your flight debrief. A full <strong>PDF report</strong> is attached with
        instructor feedback, lesson highlights, and any experience logged for this session.
      </Text>

      <Section style={summaryBox}>
        <Row>
          <Column style={{ width: "50%", paddingRight: "8px", verticalAlign: "top" }}>
            <Text style={labelStyle}>Outcome</Text>
            <Text style={valueStyle}>{props.outcomeLabel}</Text>
            {props.attemptLabel ? (
              <>
                <Text style={labelStyle}>Attempt</Text>
                <Text style={{ ...valueStyle, marginBottom: "0" }}>{props.attemptLabel}</Text>
              </>
            ) : null}
          </Column>
          <Column style={{ width: "50%", paddingLeft: "8px", verticalAlign: "top" }}>
            <Text style={labelStyle}>Instructor</Text>
            <Text style={valueStyle}>{props.instructorName}</Text>
            <Text style={labelStyle}>Aircraft</Text>
            <Text style={{ ...valueStyle, marginBottom: "0" }}>{props.aircraftRegistration}</Text>
          </Column>
        </Row>
        <Hr style={{ borderColor: "#e4e4e7", margin: "12px 0" }} />
        <Text style={labelStyle}>Flight time (recorded)</Text>
        <Text style={{ ...valueStyle, marginBottom: "0" }}>{props.flightTimeLabel}</Text>
      </Section>

      {props.focusNextLessonPreview ? (
        <>
          <Text style={{ ...labelStyle, marginBottom: "6px" }}>Focus for next lesson</Text>
          <Text
            style={{
              color: "#3f3f46",
              margin: "0 0 20px",
              fontSize: "14px",
              lineHeight: "1.55",
              whiteSpace: "pre-wrap",
            }}
          >
            {props.focusNextLessonPreview}
          </Text>
        </>
      ) : null}

      <Text style={{ color: "#3f3f46", margin: "0 0 12px", fontSize: "14px", lineHeight: "1.55" }}>
        If you have questions about this debrief, reply to this email and your school will get back to you.
      </Text>
      <Text style={{ color: "#3f3f46", margin: "0 0 4px", fontSize: "14px" }}>Kind regards,</Text>
      <Text style={{ color: "#18181b", margin: "0 0 16px", fontSize: "14px", fontWeight: 600 }}>{props.tenantName}</Text>
      {props.contactEmail ? (
        <Text style={{ color: "#71717a", margin: 0, fontSize: "13px" }}>Contact: {props.contactEmail}</Text>
      ) : null}
    </TemplateShell>
  )
}
