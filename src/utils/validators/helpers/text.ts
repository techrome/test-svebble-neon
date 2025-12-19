import z from "zod";

export const TEXT_LIMITS = {
  handle: 32,
  title: 80,
  short: 255,
  long: 2000,
} as const;

type TextProfile = keyof typeof TEXT_LIMITS;

export const text = (
  profile: TextProfile,
  { shouldTrim = true }: { shouldTrim?: boolean } = {}
) => {
  let result = z.string();
  if (shouldTrim) {
    result = result.trim();
  }
  return result.max(TEXT_LIMITS[profile]);
};

export const Text = {
  Handle: text("handle"),
  Title: text("title"),
  Short: text("short"),
  Long: text("long"),
} as const;
