import type { NextApiResponse } from "next";
import * as cookie from "cookie";

type HeadersWithGetSetCookie = Headers & { getSetCookie?: () => string[] };

export const getSetCookieLines = (
  authHeaders: HeadersWithGetSetCookie
): string[] => {
  if (typeof authHeaders.getSetCookie === "function") {
    return authHeaders.getSetCookie();
  }

  const cookieLine = authHeaders.get("set-cookie");
  return cookieLine ? [cookieLine] : [];
};
const getSetCookieAsArray = (v: string | string[] | number | undefined) =>
  typeof v === "string" ? [v] : Array.isArray(v) ? v : [];

const normalizeCookieKey = (c: cookie.SetCookie) =>
  JSON.stringify([c.name, (c.domain || "").toLowerCase(), c.path || "/"]);

export const cookieHeaderFromSetCookie = (authHeaders: Headers): string =>
  getSetCookieLines(authHeaders)
    .map((line) => line.split(";", 1)[0]?.trim() || "")
    .filter(Boolean)
    .join("; ");

const mergeCookieLines = (
  existingCookieLines: string[],
  newCookieLines: string[]
): string[] => {
  const cookieJar = new Map<string, string>();

  const addToCookieJar = (line: string) => {
    const parsed = cookie.parseSetCookie(line);
    if (!parsed) return;

    cookieJar.set(normalizeCookieKey(parsed), line);
  };

  existingCookieLines.forEach(addToCookieJar);
  newCookieLines.forEach(addToCookieJar);

  return [...cookieJar.values()];
};

export const mergeSetCookiesToHeaders = (
  target: Headers,
  source: Headers
): void => {
  const newCookieLines = getSetCookieLines(source);
  if (!newCookieLines.length) return;

  const existingCookieLines = getSetCookieLines(target);
  const mergedCookies = mergeCookieLines(existingCookieLines, newCookieLines);
  target.delete("set-cookie");
  mergedCookies.forEach((line) => {
    target.append("set-cookie", line);
  });
};

export const mergeSetCookiesToNextRes = (
  res: NextApiResponse,
  source: Headers
): void => {
  const newCookieLines = getSetCookieLines(source);
  if (!newCookieLines.length) return;

  const existingCookieLines = getSetCookieAsArray(res.getHeader("Set-Cookie"));
  const mergedCookies = mergeCookieLines(existingCookieLines, newCookieLines);
  res.setHeader("Set-Cookie", mergedCookies);
};
