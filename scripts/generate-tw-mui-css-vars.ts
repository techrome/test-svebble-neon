import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { theme } from "@/utils/theme";

type PaletteEntry = {
  path: string[];
  cssVarValue: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const shouldSkipKey = (key: string) =>
  key.endsWith("Channel") ||
  key === "mode" ||
  key === "contrastThreshold" ||
  key === "tonalOffset";

const extractMuiVar = (value: string): string | null => {
  if (!value.startsWith("var(")) return null;

  const inner = value.slice(4, -1);
  const cssVarName = inner.split(",")[0]?.trim();

  if (!cssVarName?.startsWith("--")) return null;

  return `var(${cssVarName})`;
};

const collectPaletteEntries = (
  value: unknown,
  path: string[] = [],
  out: PaletteEntry[] = []
): PaletteEntry[] => {
  if (typeof value === "string") {
    const cssVarValue = extractMuiVar(value);
    if (cssVarValue) out.push({ path, cssVarValue });
    return out;
  }

  if (!isObject(value)) return out;

  for (const [key, child] of Object.entries(value)) {
    if (shouldSkipKey(key)) continue;
    collectPaletteEntries(child, [...path, key], out);
  }

  return out;
};

const entries = collectPaletteEntries(theme.vars?.palette).sort((a, b) =>
  a.cssVarValue.localeCompare(b.cssVarValue)
);

const tailwindCss = `@theme inline {
${entries
  .map(
    ({ path, cssVarValue }) =>
      `  --color-mui-${path.join("-")}: ${cssVarValue};`
  )
  .join("\n")}
}
`;

const scss = `${entries
  .map(({ path, cssVarValue }) => `$mui-${path.join("-")}: ${cssVarValue};`)
  .join("\n")}
`;

writeFileSync(
  resolve("./src/styles/generated-tw-mui-css-vars.css"),
  tailwindCss,
  "utf8"
);

writeFileSync(resolve("./src/styles/_generated-mui-vars.scss"), scss, "utf8");

console.log(
  `Generated ${entries.length} Tailwind aliases and SCSS variables from MUI palette.`
);
