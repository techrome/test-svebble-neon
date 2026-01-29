import nodemailer from "nodemailer";
import { waitUntil } from "@vercel/functions";

import { env } from "../env";

export type SendEmailArgs = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

const port = Number(env.EMAIL_SMTP_PORT);
const from = env.EMAIL_FROM;

const transporter = nodemailer.createTransport({
  host: env.EMAIL_SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: env.EMAIL_SMTP_USER,
    pass: env.EMAIL_SMTP_PASS,
  },
});

export const sendEmail = ({ to, subject, text, html }: SendEmailArgs) => {
  // intentionally not awaiting the email to avoid timing attacks
  waitUntil(
    transporter.sendMail({ from, to, subject, text, html }).catch((err) => {
      console.error("sendEmail failed", err);
    })
  );
};
