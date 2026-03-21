import z from "@/utils/zod";

export const TEXT_LIMITS = {
  handle: 32,
  title: 80,
  short: 256,
  long: 2000,
} as const;

type TextProfile = keyof typeof TEXT_LIMITS;
type TextOptions = { shouldTrim?: boolean; required?: boolean };

export const text = (
  profile: TextProfile,
  { shouldTrim = true, required = false }: TextOptions = {}
) => {
  let result = z.string();
  if (shouldTrim) {
    result = result.trim();
  }
  if (required) {
    result = result.min(1, { error: "Field is required" });
  }
  return result.max(TEXT_LIMITS[profile], {
    error: (iss) => `Field must be less than ${iss.maximum} characters`,
  });
};

export const Text = {
  Handle: (options?: TextOptions) => text("handle", options),
  Title: (options?: TextOptions) => text("title", options),
  Short: (options?: TextOptions) => text("short", options),
  Long: (options?: TextOptions) => text("long", options),
} as const;
