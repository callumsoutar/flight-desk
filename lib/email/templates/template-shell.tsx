import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

type TemplateShellProps = {
  preview: string
  tenantName: string
  logoUrl?: string | null
  children: React.ReactNode
}

export function TemplateShell({ preview, tenantName, logoUrl, children }: TemplateShellProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 12px" }}>
          <Section style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px" }}>
            {logoUrl ? (
              <Section style={{ marginBottom: "16px" }}>
                <Img src={logoUrl} alt={tenantName} height="32" />
              </Section>
            ) : null}
            {children}
            <Text style={{ color: "#71717a", fontSize: "12px", marginTop: "20px" }}>
              Sent by Flight Desk Pro on behalf of {tenantName}. You are receiving this message because
              your account is associated with this aero club.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
