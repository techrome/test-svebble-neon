export const PLACEHOLDER_EMAIL_DOMAIN = "noemail.invalid";

export const isPlaceholderEmail = (email: string) => {
  return email.includes(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
};
