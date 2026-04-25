export function shouldSkipDebrief(instructionType: string | null | undefined) {
  return instructionType === "solo" || instructionType === "trial"
}
