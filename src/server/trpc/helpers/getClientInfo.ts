import { IncomingHttpHeaders } from "node:http";
import { isIP } from "node:net";
import { encryptForDb } from "./encrypt";

type HeadersLike = Headers | IncomingHttpHeaders;

const isWebHeaders = (headers: HeadersLike): headers is Headers =>
  typeof (headers as Headers).get === "function";

const getHeaderValue = (headers: HeadersLike, name: string): string | null => {
  if (isWebHeaders(headers)) return headers.get(name);

  const header = headers[name.toLowerCase()];
  return typeof header === "string"
    ? header
    : Array.isArray(header)
      ? header.join(",")
      : null;
};

const extractFirstIp = (header: string | string[] | undefined | null) =>
  typeof header === "string"
    ? header.split(",")[0].trim()
    : Array.isArray(header)
      ? header[0].trim()
      : "";

export const getIp = async (
  headers: HeadersLike,
  isPlainText?: boolean
): Promise<string | null> => {
  for (const ipHeader of ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"]) {
    const ip = extractFirstIp(getHeaderValue(headers, ipHeader));
    if (isIP(ip)) return isPlainText ? ip : await encryptForDb(ip);
  }

  return null;
};

export const getUserAgent = (headers: HeadersLike): string | null => {
  const userAgent = getHeaderValue(headers, "user-agent");
  return userAgent ? userAgent.slice(0, 512) : null;
};

export const getIpAndUserAgent = async (headers: HeadersLike) => {
  const ip = await getIp(headers);
  const userAgent = getUserAgent(headers);
  return { ip, userAgent };
};
