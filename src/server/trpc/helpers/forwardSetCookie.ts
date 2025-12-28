import { NextApiResponse } from "next";

type HeadersWithGetSetCookie = Headers & { getSetCookie?: () => string[] };

export function forwardSetCookie(
  _authHeaders: Headers,
  res: NextApiResponse
): void {
  const authHeaders = _authHeaders as HeadersWithGetSetCookie;

  const newCookies =
    typeof authHeaders.getSetCookie === "function"
      ? authHeaders.getSetCookie()
      : authHeaders.get("set-cookie")
        ? [authHeaders.get("set-cookie")!]
        : [];

  if (newCookies.length === 0) {
    return;
  }

  const existing = res.getHeader("Set-Cookie");
  const existingCookies =
    typeof existing === "string"
      ? [existing]
      : Array.isArray(existing)
        ? existing.map(String)
        : [];

  res.setHeader("Set-Cookie", [...existingCookies, ...newCookies]);
}
