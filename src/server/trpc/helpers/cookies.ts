import type { NextApiResponse } from "next";

type HeadersWithGetSetCookie = Headers & { getSetCookie?: () => string[] };

export const getSetCookieLines = (_authHeaders: Headers): string[] => {
  const authHeaders = _authHeaders as HeadersWithGetSetCookie;
  if (typeof authHeaders.getSetCookie === "function") {
    return authHeaders.getSetCookie();
  }

  const cookieLine = authHeaders.get("set-cookie");
  return cookieLine ? [cookieLine] : [];
};

export const cookieHeaderFromSetCookie = (_authHeaders: Headers): string =>
  getSetCookieLines(_authHeaders)
    .map((line) => line.split(";", 1)[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");

export const appendSetCookiesToHeaders = (
  target: Headers,
  source: Headers
): void => {
  getSetCookieLines(source).forEach((line) => {
    target.append("set-cookie", line);
  });
};

export const appendSetCookiesToNextRes = (
  res: NextApiResponse,
  source: Headers
): void => {
  const newCookies = getSetCookieLines(source);
  if (newCookies.length === 0) return;

  res.appendHeader("Set-Cookie", newCookies);
};
