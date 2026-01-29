import { render, toPlainText } from "@react-email/render";
import VerifyEmail, { VerifyEmailProps } from "../VerifyEmail";
import ResetPassword, { ResetPasswordProps } from "../ResetPassword";

export const buildVerifyEmail = async (props: VerifyEmailProps) => {
  const html = await render(<VerifyEmail {...props} />);
  return {
    html,
    text: toPlainText(html),
  };
};

export const buildResetPassword = async (props: ResetPasswordProps) => {
  const html = await render(<ResetPassword {...props} />);
  return {
    html,
    text: toPlainText(html),
  };
};
