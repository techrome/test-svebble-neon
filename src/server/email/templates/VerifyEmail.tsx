import React from "react";
import {
  Html,
  Head,
  Preview,
  Tailwind,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Link,
  pixelBasedPreset,
} from "@react-email/components";
import { APP_NAME } from "@/utils/constants";
import { colorSchemes } from "@/utils/colors";

export type VerifyEmailProps = { url: string };

const VerifyEmail = (props: VerifyEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Verify your email for {APP_NAME}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
          <Container>
            <Heading>Verify your email</Heading>
            <Text>Click the button to finish setting up your account.</Text>
            <Button
              className={`text-white bg-[${colorSchemes.light.palette.primary.main}] text-lg rounded-2xl px-10 py-4`}
              href={props.url}
            >
              Verify email
            </Button>
            <Text>
              {`If the button doesn't work, click or copy/paste this link: `}
              <Link href={props.url}>{props.url}</Link>
            </Text>
            <Text>The link will expire in 1 hour.</Text>
          </Container>
          <Container>
            <Text className="text-xs">
              {`If you didn’t make this request, you can ignore this email.`}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

VerifyEmail.PreviewProps = {
  url: "https://example.com/verify?token=dev",
} satisfies VerifyEmailProps;

export default VerifyEmail;
