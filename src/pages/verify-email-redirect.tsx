import React from "react";
import { CircularProgress, Typography } from "@mui/material";
import ErrorIcon from "@mui/icons-material/Error";
import EmailIcon from "@mui/icons-material/Email";
import { useRouter } from "next/router";

import { VerticalStack } from "@/components/Layout/Containers";
import Button from "@/components/Button/Button";
import { ROUTES } from "@/utils/routes";

const VerifyEmailRedirect = () => {
  const router = useRouter();

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const token =
    typeof router.query.token === "string" ? router.query.token : null;

  const onVerifyClick = () => {
    router.replace(
      `/api/auth/verify-email?token=${token}&callbackURL=${ROUTES.private_emailVerified}`
    );
  };

  if (!router.isReady || !isMounted) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <CircularProgress />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center">
        <Typography variant="h2" component="div" textAlign="center">
          <ErrorIcon fontSize="inherit" color="error" />
        </Typography>
        <Typography variant="h4" component="h2" textAlign="center">
          Invalid email URL
        </Typography>
      </div>
    );
  }

  return (
    <div className="flex-1 flex justify-center items-center">
      <VerticalStack addClassName="items-center" spacing="lg">
        <VerticalStack addClassName="items-center">
          <VerticalStack addClassName="justify-center items-center">
            <Typography variant="h2" component="div" textAlign="center">
              <EmailIcon fontSize="inherit" />
            </Typography>
            <Typography variant="h3" component="h1" textAlign="center">
              Verify your email
            </Typography>
            <Typography variant="h6" component="h2" textAlign="center">
              {`Click the button to complete verification.`}
            </Typography>
          </VerticalStack>
        </VerticalStack>
        <div className="w-md max-w-full">
          <Button
            onClick={onVerifyClick}
            variant="contained"
            color="primary"
            size="large"
            fullWidth
          >
            Verify email
          </Button>
        </div>
      </VerticalStack>
    </div>
  );
};

export default VerifyEmailRedirect;
