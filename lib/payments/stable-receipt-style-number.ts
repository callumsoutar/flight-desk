/**
 * When `receipt_number` is not stored yet (migration pending), produce a stable
 * 5–6 digit number from the row id so references look like real receipts (e.g. 90878).
 * Range: 10000–899999. Same id always maps to the same number.
 */
export function stableReceiptStyleNumberFromUuid(id: string): number {
  let h = 2166136261
  const s = id.toLowerCase()
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 10000 + ((h >>> 0) % 890000)
}
