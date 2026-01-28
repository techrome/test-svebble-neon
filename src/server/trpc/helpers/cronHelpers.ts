import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { env } from "../../env";

export const validateCronRoute = (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return false;
  }

  const secret = env.CRON_SECRET;
  const auth = req.headers.authorization;

  if (!secret || auth !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }

  return true;
};

export const withCronAuth =
  (handler: NextApiHandler): NextApiHandler =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (!validateCronRoute(req, res)) return;
    return handler(req, res);
  };
