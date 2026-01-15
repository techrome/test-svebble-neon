import { randomUUID } from "node:crypto";

import { PLACEHOLDER_EMAIL_DOMAIN } from "@/trpc/helpers/email";

export const generatePlaceholderEmail = () => {
  return `u-${randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`.toLowerCase();
};
