import { NextResponse } from "next/server"

export const NO_STORE_HEADERS = { "cache-control": "no-store" } as const

export function invalidPayloadResponse() {
  return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE_HEADERS })
}

export function internalServerErrorResponse(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS })
}
