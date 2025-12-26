import React from "react";
import { Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import Image from "next/image";

import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";
import { VerticalStack } from "@/components/Layout/Containers";
import Button from "@/components/Button/Button";
import { Divider } from "@/components/Layout/Dividers";
import { AuthType } from "@/components/AuthForm/AuthForm";

type WrapperProps = {
  authType: AuthType;
  isLoading: boolean;
  children: React.ReactNode;
  onGoogleClick: () => void;
  onGuestClick: () => void;
};

export const AuthWrapper = (props: WrapperProps) => {
  const isLogin = props.authType === "login";

  return (
    <>
      <VerticalStack>
        <Button
          disabled={props.isLoading}
          color="inherit"
          variant="outlined"
          fullWidth
          size="large"
          onClick={props.onGoogleClick}
          startIcon={
            <Image
              src="/icons/google.svg"
              alt="google-icon"
              width={22}
              height={22}
              priority
            />
          }
        >
          {isLogin ? "Log in" : "Sign up"} with Google
        </Button>
        <Button
          disabled={props.isLoading}
          color="inherit"
          variant="outlined"
          fullWidth
          size="large"
          onClick={props.onGuestClick}
          startIcon={<PersonIcon />}
        >
          Continue as guest
        </Button>
      </VerticalStack>
      <Divider className="my-4">
        or {isLogin ? "log in with your credentials" : "create an account"}
      </Divider>
      {props.children}
      <Typography variant="subtitle2" className="mt-4">
        <span>
          By continuing, you agree to the{" "}
          <Link target="_blank" href={ROUTES.terms}>
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link target="_blank" href={ROUTES.privacyPolicy}>
            Privacy Policy
          </Link>
        </span>
      </Typography>
    </>
  );
};
