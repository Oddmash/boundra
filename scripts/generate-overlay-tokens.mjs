import { readFileSync, writeFileSync } from "node:fs";

const source = new URL("../packages/ui/src/overlay-tokens.json", import.meta.url);
const output = new URL("../packages/ui/src/overlay-tokens.ts", import.meta.url);
const tokens = JSON.parse(readFileSync(source, "utf8"));
// Compile the data into JavaScript so the browser and supported Node hosts do
// not require JSON module support to import the published overlay.
const generated =
  "// Generated from overlay-tokens.json by pnpm generate-overlay-tokens.\n" +
  `export const overlayTokens = ${JSON.stringify(tokens, null, 2)} as const;\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== generated) {
    console.error("Overlay tokens are stale. Run pnpm generate-overlay-tokens.");
    process.exitCode = 1;
  }
} else {
  writeFileSync(output, generated);
}
