import React, { useEffect } from "react";
import { CircularProgress, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

import { VerticalStack } from "@/components/Layout/Containers";
import Link from "@/components/Link/Link";
import Button from "@/components/Button/Button";
import { ROUTES } from "@/utils/routes";
import { useRouter } from "next/router";
import { getRouterQueryValue } from "@/utils/query";

export type BroadcastChannels = "auth-events";
export type BroadcastChannelEvent = "email-verified";

const EmailVerified = () => {
  const router = useRouter();

  const error = getRouterQueryValue(router.query.error);

  useEffect(() => {
    if (router.isReady && !error) {
      const bc = new BroadcastChannel(
        "auth-events" satisfies BroadcastChannels
      );
      bc.postMessage("email-verified" satisfies BroadcastChannelEvent);
      bc.close();
    }
    // eslint-disable-next-line
  }, [router.isReady]);

  if (!router.isReady) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="flex-1 flex justify-center items-center">
      <VerticalStack addClassName="items-center" spacing="lg">
        <VerticalStack addClassName="items-center">
          <VerticalStack addClassName="justify-center items-center">
            <Typography variant="h2" component="div" textAlign="center">
              {error ? (
                <ErrorIcon fontSize="inherit" color="error" />
              ) : (
                <CheckCircleIcon fontSize="inherit" color="success" />
              )}
            </Typography>
            <Typography variant="h4" component="h2" textAlign="center">
              {error
                ? "Email verification link is either expired or invalid."
                : "Your email has been successfully verified."}
            </Typography>
          </VerticalStack>
        </VerticalStack>
        <Link href={ROUTES.home} className="w-md max-w-full">
          <Button variant="contained" color="primary" size="large" fullWidth>
            Return to Home page
          </Button>
        </Link>
      </VerticalStack>
    </div>
  );
};

export default EmailVerified;
