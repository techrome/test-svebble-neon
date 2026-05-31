import { days } from "@/utils/cacheTime";

export const cacheControl = `public, max-age=${days(2, true)}` as const;
