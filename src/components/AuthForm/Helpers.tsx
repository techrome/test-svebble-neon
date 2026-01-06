import React from "react";
import { CircularProgress, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import Image from "next/image";

import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";
import { VerticalStack } from "@/components/Layout/Containers";
import Button from "@/components/Button/Button";
import { Divider } from "@/components/Layout/Dividers";
import { AuthType } from "@/components/AuthForm/AuthForm";
import { useAppSnackbar } from "@/utils/snackbar";
import { trpc } from "@/trpc";
import useUser from "@/trpc/hooks/useUser";
import { useRouter } from "next/router";

type WrapperProps = {
  authType: AuthType;
  disabled: boolean;
  children: React.ReactNode;
  onSuccess?: () => void;
};

export const AuthWrapper = (props: WrapperProps) => {
  const isLogin = props.authType === "login";

  const { addAppSnackbar } = useAppSnackbar();
  const utils = trpc.useUtils();

  const googleLoginMutation = trpc.auth.googleLogin.useMutation({
    onSuccess(data) {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError() {
      addAppSnackbar({ message: "Something went wrong.", variant: "error" });
    },
  });
  const guestLoginMutation = trpc.auth.loginAnonymous.useMutation({
    onSuccess() {
      utils.auth.user.invalidate();
      props.onSuccess?.();
    },
  });

  const onGoogleClick = async () => {
    googleLoginMutation.mutate();
  };

  const onGuestClick = () => {
    guestLoginMutation.mutate();
  };

  const isDisabled =
    guestLoginMutation.isPending ||
    googleLoginMutation.isPending ||
    props.disabled;

  return (
    <>
      <VerticalStack>
        <Button
          isLoading={googleLoginMutation.isPending}
          disabled={isDisabled}
          color="inherit"
          variant="outlined"
          fullWidth
          size="large"
          onClick={onGoogleClick}
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
          isLoading={guestLoginMutation.isPending}
          disabled={isDisabled}
          color="inherit"
          variant="outlined"
          fullWidth
          size="large"
          onClick={onGuestClick}
          startIcon={<PersonIcon />}
        >
          Continue as guest
        </Button>
      </VerticalStack>
      <Divider className="my-4">
        or {isLogin ? "log in with your credentials" : "create an account"}
      </Divider>
      {props.children}
      <TermsLabel />
    </>
  );
};

export const TermsLabel = () => {
  return (
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
  );
};

type AuthPageWrapperProps = {
  children: React.ReactNode;
};

export const AuthPageWrapper = (props: AuthPageWrapperProps) => {
  const user = useUser();
  const router = useRouter();

  if (user.data?.user?.id) {
    router.replace(ROUTES.private_myProfile);
    return;
  }

  return (
    <div className="flex-1 flex justify-center items-center">
      {user.isPending ? (
        <CircularProgress />
      ) : (
        <div className="max-w-[600px] w-full">{props.children}</div>
      )}
    </div>
  );
};
