import React from "react";
import { Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { trpc } from "@/trpc";
import { VerticalStack } from "@/components/Layout/Containers";
import Link from "@/components/Link/Link";
import Button from "@/components/Button/Button";
import { ROUTES } from "@/utils/routes";

const EmailVerified = () => {
  return (
    <div className="flex-1 flex justify-center items-center">
      <VerticalStack addClassName="items-center" spacing="lg">
        <VerticalStack addClassName="items-center">
          <VerticalStack addClassName="justify-center items-center">
            <Typography variant="h2" component="div" textAlign="center">
              <CheckCircleIcon fontSize="inherit" color="success" />
            </Typography>
            <Typography variant="h4" component="h2" textAlign="center">
              Your email has been successfully verified.
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
