/**
 * Re-apply explicit type to jsonSchema in generated.ts so TS does not infer circular any.
 * Run after: npm run schema:generate
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "lib", "schema", "generated.ts");
let content = fs.readFileSync(file, "utf8");

const old = "export const jsonSchema = z.lazy(() =>";
const fix = "export const jsonSchema: z.ZodType<unknown> = z.lazy(() =>";

if (content.includes(old) && !content.includes(fix)) {
  content = content.replace(old, fix);
  fs.writeFileSync(file, content);
  console.log("Applied jsonSchema type fix to lib/schema/generated.ts");
} else if (content.includes(fix)) {
  console.log("jsonSchema fix already present.");
} else {
  console.warn("Could not find jsonSchema export to fix.");
}
