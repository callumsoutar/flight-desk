import { Resend } from "resend"

let resendClient: Resend | null = null

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set")
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }
  return resendClient
}
