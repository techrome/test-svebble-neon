import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { theme } from "@/utils/theme";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const shouldSkipKey = (key: string) =>
  key.endsWith("Channel") ||
  key === "mode" ||
  key === "contrastThreshold" ||
  key === "tonalOffset";

const collectPaletteVars = (
  value: unknown,
  path: string[] = [],
  out: string[] = []
): string[] => {
  if (typeof value === "string") {
    if (value.startsWith("var(")) {
      const commaIndex = value.indexOf(",");
      if (commaIndex !== -1) value = `${value.slice(0, commaIndex)})`;
      out.push(`  --color-mui-${path.join("-")}: ${value};`);
    }
    return out;
  }

  if (!isObject(value)) return out;

  for (const [key, child] of Object.entries(value)) {
    if (shouldSkipKey(key)) continue;
    collectPaletteVars(child, [...path, key], out);
  }

  return out;
};

const lines = collectPaletteVars(theme.vars?.palette).sort();

const css = `@theme inline {
${lines.join("\n")}
}
`;

writeFileSync(
  resolve("./src/styles/generated-tw-mui-css-vars.css"),
  css,
  "utf8"
);

console.log(
  `Generated ${lines.length} Tailwind color aliases from MUI palette.`
);
