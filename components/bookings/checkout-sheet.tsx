"use client"

import React, { Fragment } from "react"

export type NoticeType = "critical" | "warning" | "info"

export interface SystemNotice {
  type: NoticeType
  message: string
}

export interface CheckoutSheetData {
  aircraft: string
  registration: string
  instructor: string
  member: string
  flightDescription: string
  date: string
  printedAt: string
  systemNotices: SystemNotice[]
  logoUrl?: string | null
  clubName?: string
}

const C = {
  ink: "#111111",
  text: "#1F1F1F",
  muted: "#6B6B6B",
  faint: "#9A9A9A",
  rule: "#1F1F1F",
  ruleSoft: "#D4D4D4",
  ruleSofter: "#E6E6E6",
  field: "#9A9A9A",
  headBg: "#F4F4F5",
  noticeCrit: "#7A1818",
  noticeWarn: "#6B5200",
} as const

/* ─────────────────── Primitives ─────────────────── */

function Lbl({ t, size = 6.5 }: { t: string; size?: number }) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: C.muted,
        lineHeight: 1,
      }}
    >
      {t}
    </div>
  )
}

function Field({ width, height = 13 }: { width?: number | string; height?: number }) {
  return (
    <div
      style={{
        height,
        width,
        borderBottom: `1px solid ${C.field}`,
        flex: width === undefined ? 1 : undefined,
      }}
    />
  )
}

function SecHead({ t, mt = 10 }: { t: string; mt?: number }) {
  return (
    <div style={{ marginTop: mt, marginBottom: 5 }}>
      <div
        style={{
          fontSize: 7.5,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: C.ink,
          paddingBottom: 3,
          borderBottom: `1px solid ${C.ruleSoft}`,
        }}
      >
        {t}
      </div>
    </div>
  )
}

function WriteLines({ n, height = 14 }: { n: number; height?: number }) {
  return (
    <div>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ height, borderBottom: `1px solid ${C.ruleSofter}` }} />
      ))}
    </div>
  )
}

/* ─────────────────── Reusable cells ─────────────────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "62px 1fr", columnGap: 8, alignItems: "baseline" }}>
      <div
        style={{
          fontSize: 8,
          fontWeight: 600,
          color: C.muted,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: C.ink, lineHeight: 1.25 }}>{value}</div>
    </div>
  )
}

function LabeledLine({ label, lineWidth }: { label: string; lineWidth?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", columnGap: 8, alignItems: "end", height: 18 }}>
      <Lbl t={label} />
      <div style={{ display: "flex", alignItems: "end" }}>
        <Field width={lineWidth} />
      </div>
    </div>
  )
}

/* ─────────────────── Header (left side) ─────────────────── */

function LeftHeader({ d }: { d: CheckoutSheetData }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 8 }}>
      {d.logoUrl ? (
        <div
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Tenant logo URLs are arbitrary signed URLs for print layout. */}
          <img src={d.logoUrl} style={{ width: 56, height: 56, objectFit: "contain" }} alt="" />
        </div>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 7,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.muted,
            lineHeight: 1.1,
          }}
        >
          {d.clubName ?? "Flight Operations"}
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: C.muted,
            letterSpacing: "0.04em",
            marginTop: 3,
          }}
        >
          Flight Check Out Sheet
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{d.date}</div>
      </div>
    </div>
  )
}

/* ─────────────────── Notice (used inside left Notes area) ─────────────────── */

function Notice({ notice }: { notice: SystemNotice }) {
  const crit = notice.type === "critical"
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "1px 0" }}>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: crit ? C.noticeCrit : C.noticeWarn,
          lineHeight: 1.4,
          flexShrink: 0,
          width: 8,
        }}
      >
        {crit ? "!" : "•"}
      </div>
      <div style={{ fontSize: 8, color: C.text, lineHeight: 1.35 }}>{notice.message}</div>
    </div>
  )
}

/* ─────────────────── LEFT PANEL ─────────────────── */

function LeftPanel({ d }: { d: CheckoutSheetData }) {
  const flightTimes = [
    "Hobbs Start",
    "Dual End",
    "Solo End",
    "Flight Time",
    "Tacho Start",
    "Tacho End",
  ]

  const equipment = ["Life Jackets", "Headsets", "Pickets", "Maps", "AIP", "Cushions"]

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "12px 16px 10px 16px",
        borderRight: `1px solid ${C.ruleSoft}`,
        minWidth: 0,
      }}
    >
      <LeftHeader d={d} />

      <div
        style={{
          borderTop: `1px solid ${C.rule}`,
          paddingTop: 8,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "62px 1fr",
            columnGap: 8,
            alignItems: "baseline",
            marginBottom: 7,
          }}
        >
          <div style={{ fontSize: 8, fontWeight: 600, color: C.muted }}>Flight</div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.ink,
              letterSpacing: "-0.005em",
              lineHeight: 1.2,
            }}
          >
            {d.flightDescription}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            rowGap: 5,
            columnGap: 14,
          }}
        >
          <InfoRow label="Aircraft" value={d.registration} />
          <InfoRow label="Instructor" value={d.instructor} />
          <InfoRow label="Member" value={d.member} />
        </div>
      </div>

      {d.systemNotices.length > 0 ? (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          {d.systemNotices.slice(0, 2).map((n, i) => (
            <Notice key={i} notice={n} />
          ))}
        </div>
      ) : null}
      <WriteLines n={d.systemNotices.length > 0 ? 2 : 3} />

      {/* Flight Times + Equipment */}
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 18,
        }}
      >
        <div>
          <SecHead t="Flight Times" mt={0} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {flightTimes.map((l) => (
              <LabeledLine key={l} label={l} />
            ))}
          </div>
        </div>
        <div>
          <SecHead t="Equipment" mt={0} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 30px 30px",
              alignItems: "center",
              rowGap: 3,
            }}
          >
            <div />
            <Lbl t="Taken" />
            <Lbl t="Ret" />
            {equipment.map((item) => (
              <Fragment key={item}>
                <div style={{ fontSize: 8, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{item}</div>
                <div
                  style={{
                    width: 22,
                    height: 11,
                    borderBottom: `1px solid ${C.field}`,
                  }}
                />
                <div
                  style={{
                    width: 14,
                    height: 11,
                    border: `1px solid ${C.field}`,
                  }}
                />
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Flight Times Start/End + Other Charges */}
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          columnGap: 18,
        }}
      >
        <div>
          <SecHead t="Times" mt={0} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <LabeledLine label="Start Time" />
            <LabeledLine label="End Time" />
          </div>
        </div>
        <div>
          <SecHead t="Other Charges" mt={0} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {["Flight Plans", "F/S Landings", "Circuits"].map((l) => (
              <LabeledLine key={l} label={l} lineWidth={42} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div
        style={{
          fontSize: 7.5,
          color: C.muted,
          letterSpacing: "0.04em",
          marginTop: 6,
        }}
      >
        Printed {d.printedAt}
      </div>
    </div>
  )
}

/* ─────────────────── RIGHT PANEL ─────────────────── */

function SartimeBox() {
  return (
    <div
      style={{
        border: `1px solid ${C.ruleSoft}`,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 70px 1fr" }}>
        {(
          [
            ["SARTIME UTC", true],
            ["", false],
            ["SSR Code", true],
            ["", false],
            ["Local", true],
            ["", false],
            ["Club ETA", true],
            ["", false],
          ] as [string, boolean][]
        ).map(([label, isLabel], i) => {
          const row = Math.floor(i / 4)
          const col = i % 4
          const isLast = col === 3
          const isBottom = row === 1
          return (
            <div
              key={i}
              style={{
                background: isLabel ? C.headBg : "white",
                fontSize: 7,
                fontWeight: isLabel ? 700 : 500,
                letterSpacing: isLabel ? "0.1em" : 0,
                textTransform: isLabel ? "uppercase" : "none",
                color: isLabel ? C.ink : C.text,
                padding: "5px 7px",
                borderRight: isLast ? "none" : `1px solid ${C.ruleSoft}`,
                borderBottom: isBottom ? "none" : `1px solid ${C.ruleSoft}`,
                minHeight: 18,
              }}
            >
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AtisTable() {
  /*
    12-column grid (cloud splits into 4 sub-columns):
      1: Airport
      2: Info
      3: RWY
      4: Wind
      5: Vis
      6-9: Few / Sct / Bkn / Ovc  (Cloud header spans all four)
      10: T/DP
      11: QNH
      12: 2000ft

    All units fr-based so the table fits whatever the right column width is.
  */
  const tpl =
    "1.4fr 0.9fr 0.8fr 1.2fr 0.8fr 0.6fr 0.6fr 0.6fr 0.6fr 0.9fr 0.9fr 1.1fr"

  const tallHeaders: { label: string; col: number }[] = [
    { label: "Airport", col: 1 },
    { label: "Info", col: 2 },
    { label: "RWY", col: 3 },
    { label: "Wind", col: 4 },
    { label: "Vis", col: 5 },
    { label: "T/DP", col: 10 },
    { label: "QNH", col: 11 },
    { label: "2000ft", col: 12 },
  ]
  const cloudSubs = ["Few", "Sct", "Bkn", "Ovc"]

  const cellBorderRight = (lastCol: boolean) =>
    lastCol ? "none" : `1px solid ${C.ruleSofter}`

  return (
    <div
      style={{
        border: `1px solid ${C.ruleSoft}`,
        borderRadius: 3,
        overflow: "hidden",
        background: "white",
      }}
    >
      {/* Header block — uses explicit grid placement so non-cloud headers span both header rows */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: tpl,
          gridTemplateRows: "auto auto",
          background: C.headBg,
          borderBottom: `1px solid ${C.ruleSoft}`,
        }}
      >
        {tallHeaders.map((h) => (
          <div
            key={h.label}
            style={{
              gridColumn: `${h.col} / span 1`,
              gridRow: "1 / span 2",
              fontSize: 6.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.ink,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 2px",
              borderRight: cellBorderRight(h.col === 12),
              minHeight: 26,
            }}
          >
            {h.label}
          </div>
        ))}

        {/* Cloud header (spans 4 cols on row 1) */}
        <div
          style={{
            gridColumn: "6 / span 4",
            gridRow: "1 / span 1",
            fontSize: 6.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: C.ink,
            textAlign: "center",
            padding: "3px 0 2px 0",
            borderBottom: `1px solid ${C.ruleSoft}`,
            borderRight: `1px solid ${C.ruleSofter}`,
          }}
        >
          Cloud
        </div>

        {/* Cloud sub-headers on row 2 */}
        {cloudSubs.map((s, i) => (
          <div
            key={s}
            style={{
              gridColumn: `${6 + i} / span 1`,
              gridRow: "2 / span 1",
              fontSize: 5.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.muted,
              textAlign: "center",
              padding: "2px 0",
              borderRight: i === cloudSubs.length - 1 ? `1px solid ${C.ruleSofter}` : `1px solid ${C.ruleSofter}`,
            }}
          >
            {s}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          style={{
            display: "grid",
            gridTemplateColumns: tpl,
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 16,
                borderRight: cellBorderRight(i === 11),
                borderBottom: row === 2 ? "none" : `1px solid ${C.ruleSofter}`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function FuelLogTable() {
  return (
    <div style={{ border: `1px solid ${C.ruleSoft}`, borderRadius: 2, overflow: "hidden" }}>
      <div
        style={{
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: C.ink,
          textAlign: "center",
          padding: "4px 0",
          background: C.headBg,
          borderBottom: `1px solid ${C.ruleSoft}`,
        }}
      >
        Fuel Log
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {(["Left", "Right"] as const).map((side, idx) => (
          <div
            key={side}
            style={{
              borderRight: idx === 0 ? `1px solid ${C.ruleSoft}` : "none",
            }}
          >
            <div
              style={{
                fontSize: 7,
                fontWeight: 700,
                textAlign: "center",
                color: C.ink,
                padding: "3px 0",
                borderBottom: `1px solid ${C.ruleSoft}`,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {side}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {(["Time", "Fuel"] as const).map((h, i) => (
                <div
                  key={h}
                  style={{
                    fontSize: 6.5,
                    fontWeight: 600,
                    color: C.muted,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textAlign: "center",
                    padding: "2px 0",
                    borderRight: i === 0 ? `1px solid ${C.ruleSofter}` : "none",
                    borderBottom: `1px solid ${C.ruleSofter}`,
                  }}
                >
                  {h}
                </div>
              ))}
              {[0, 1].map((row) => (
                <Fragment key={row}>
                  <div
                    style={{
                      height: 14,
                      borderRight: `1px solid ${C.ruleSofter}`,
                      borderBottom: row === 1 ? "none" : `1px solid ${C.ruleSofter}`,
                    }}
                  />
                  <div
                    style={{
                      height: 14,
                      borderBottom: row === 1 ? "none" : `1px solid ${C.ruleSofter}`,
                    }}
                  />
                </Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RightPanel() {
  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "12px 16px 12px 16px",
        minWidth: 0,
      }}
    >
      <SartimeBox />

      <div style={{ marginTop: 8 }}>
        <AtisTable />
      </div>

      <SecHead t="Notes" />
      <WriteLines n={6} />

      <SecHead t="Defects" />
      <WriteLines n={3} />

      <div style={{ flex: 1 }} />

      <div style={{ marginTop: 8 }}>
        <FuelLogTable />
      </div>
    </div>
  )
}

/* ─────────────────── Root ─────────────────── */

export function CheckoutSheet({ data }: { data: CheckoutSheetData }) {
  return (
    <div
      className="checkout-sheet"
      style={{
        width: 680,
        height: 480,
        display: "flex",
        background: "white",
        border: `1px solid ${C.ruleSoft}`,
        fontFamily: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
        color: C.text,
        overflow: "hidden",
      }}
    >
      <LeftPanel d={data} />
      <RightPanel />
    </div>
  )
}
