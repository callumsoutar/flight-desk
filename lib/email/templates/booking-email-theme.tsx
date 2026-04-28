import { Head } from "@react-email/components"
import * as React from "react"

const bookingEmailThemeCss = `
  :root {
    color-scheme: light dark;
    supported-color-schemes: light dark;
  }

  .email-body {
    margin: 0 !important;
    padding: 0 !important;
    background-color: #eceef1 !important;
    color: #111111 !important;
  }

  .email-wrap {
    width: 100% !important;
  }

  .email-frame {
    background-color: #ffffff !important;
    border: 1px solid #d7dbe2 !important;
    border-radius: 24px !important;
    overflow: hidden !important;
  }

  .email-header {
    background-color: #12161d !important;
  }

  .email-card {
    background-color: #ffffff !important;
  }

  .email-heading {
    color: #111111 !important;
  }

  .email-copy {
    color: #5f636b !important;
  }

  .email-eyebrow {
    color: #8a9099 !important;
  }

  .email-panel {
    background-color: #f5f6f7 !important;
    border: 1px solid #e5e7eb !important;
  }

  .email-divider {
    background-color: #dfe3e8 !important;
  }

  .email-label {
    color: #6b7280 !important;
  }

  .email-value-strong {
    color: #111111 !important;
  }

  .email-value {
    color: #3f3f46 !important;
  }

  .email-button {
    background-color: #161a22 !important;
    color: #ffffff !important;
    border: 1px solid #161a22 !important;
  }

  .email-button-text {
    color: #ffffff !important;
  }

  .email-info-box {
    background-color: #edf3ff !important;
    border: 1px solid #d6e3ff !important;
  }

  .email-info-title {
    color: #111111 !important;
  }

  .email-info-copy {
    color: #405168 !important;
  }

  .email-info-icon {
    background-color: #161a22 !important;
  }

  .email-help-link {
    color: #111111 !important;
  }

  .email-footer {
    background-color: #12161d !important;
  }

  .email-footer-link {
    color: #f5f5f5 !important;
  }

  .email-footer-copy {
    color: #9ca3af !important;
  }

  .email-tag {
    color: #ffffff !important;
    border-color: rgba(255, 255, 255, 0.18) !important;
    background-color: rgba(255, 255, 255, 0.08) !important;
  }

  .email-header-date,
  .email-header-title {
    color: #ffffff !important;
  }

  .email-change-label {
    color: #4b5563 !important;
  }

  .email-change-before {
    color: #8b95a1 !important;
  }

  .email-change-arrow {
    color: #6b7280 !important;
  }

  .email-change-after {
    color: #067647 !important;
  }

  a[x-apple-data-detectors],
  #MessageViewBody a {
    color: inherit !important;
    text-decoration: none !important;
    font-size: inherit !important;
    font-family: inherit !important;
    font-weight: inherit !important;
    line-height: inherit !important;
  }

  @media (prefers-color-scheme: dark) {
    .email-body {
      background-color: #000000 !important;
      color: #f5f5f5 !important;
    }

    .email-frame,
    .email-card {
      background-color: #0a0a0a !important;
      border-color: #27272a !important;
    }

    .email-heading {
      color: #fafafa !important;
    }

    .email-copy {
      color: #b4b8bf !important;
    }

    .email-eyebrow,
    .email-label {
      color: #8f98a3 !important;
    }

    .email-panel {
      background-color: #17181a !important;
      border-color: #2a2d31 !important;
    }

    .email-divider {
      background-color: #2a2d31 !important;
    }

    .email-value-strong {
      color: #f5f5f5 !important;
    }

    .email-value {
      color: #d2d6dc !important;
    }

    .email-button {
      background-color: #f5f5f5 !important;
      color: #111111 !important;
      border-color: #f5f5f5 !important;
    }

    .email-button-text {
      color: #111111 !important;
    }

    .email-info-box {
      background-color: #18263e !important;
      border-color: #31456d !important;
    }

    .email-info-title {
      color: #ffffff !important;
    }

    .email-info-copy {
      color: #d9e4fb !important;
    }

    .email-info-icon {
      background-color: #f5f5f5 !important;
    }

    .email-help-link {
      color: #fafafa !important;
    }

    .email-footer-link {
      color: #f5f5f5 !important;
    }

    .email-footer-copy {
      color: #969fab !important;
    }

    .email-change-label {
      color: #aab2bd !important;
    }

    .email-change-before {
      color: #8f98a3 !important;
    }

    .email-change-arrow {
      color: #b4b8bf !important;
    }

    .email-change-after {
      color: #7ee2a8 !important;
    }
  }

  [data-ogsc] .email-body {
    background-color: #000000 !important;
    color: #f5f5f5 !important;
  }

  [data-ogsc] .email-frame,
  [data-ogsc] .email-card {
    background-color: #0a0a0a !important;
    border-color: #27272a !important;
  }

  [data-ogsc] .email-heading {
    color: #fafafa !important;
  }

  [data-ogsc] .email-copy {
    color: #b4b8bf !important;
  }

  [data-ogsc] .email-eyebrow,
  [data-ogsc] .email-label {
    color: #8f98a3 !important;
  }

  [data-ogsc] .email-panel {
    background-color: #17181a !important;
    border-color: #2a2d31 !important;
  }

  [data-ogsc] .email-divider {
    background-color: #2a2d31 !important;
  }

  [data-ogsc] .email-value-strong {
    color: #f5f5f5 !important;
  }

  [data-ogsc] .email-value {
    color: #d2d6dc !important;
  }

  [data-ogsc] .email-button {
    background-color: #f5f5f5 !important;
    color: #111111 !important;
    border-color: #f5f5f5 !important;
  }

  [data-ogsc] .email-button-text {
    color: #111111 !important;
  }

  [data-ogsc] .email-info-box {
    background-color: #18263e !important;
    border-color: #31456d !important;
  }

  [data-ogsc] .email-info-title {
    color: #ffffff !important;
  }

  [data-ogsc] .email-info-copy {
    color: #d9e4fb !important;
  }

  [data-ogsc] .email-info-icon {
    background-color: #f5f5f5 !important;
  }

  [data-ogsc] .email-help-link {
    color: #fafafa !important;
  }

  [data-ogsc] .email-footer-link {
    color: #f5f5f5 !important;
  }

  [data-ogsc] .email-footer-copy {
    color: #969fab !important;
  }

  [data-ogsc] .email-change-label {
    color: #aab2bd !important;
  }

  [data-ogsc] .email-change-before {
    color: #8f98a3 !important;
  }

  [data-ogsc] .email-change-arrow {
    color: #b4b8bf !important;
  }

  [data-ogsc] .email-change-after {
    color: #7ee2a8 !important;
  }

`

export function BookingEmailHead() {
  return (
    <Head>
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <style>{bookingEmailThemeCss}</style>
    </Head>
  )
}
