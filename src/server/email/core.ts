import nodemailer from "nodemailer";

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

export const sendEmail = async ({ to, subject, text, html }: SendEmailArgs) => {
  await transporter.sendMail({ from, to, subject, text, html });
};
