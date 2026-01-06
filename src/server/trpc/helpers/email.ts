import { randomUUID } from "node:crypto";

export const PLACEHOLDER_EMAIL_DOMAIN = "noemail.invalid";

export const generatePlaceholderEmail = () => {
  return `u-${randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`.toLowerCase();
};
