import React from "react";
import { Typography } from "@mui/material";

import { SwitchingStack, VerticalStack } from "@/components/Layout/Containers";
import { SwitchingDivider } from "@/components/Layout/Dividers";
import Button from "@/components/Button/Button";
import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";

type Props = {
  errorCode: string | number;
  errorText: string;
  errorDetails?: React.ReactNode;
};

const ErrorSection = ({ errorCode, errorText, errorDetails }: Props) => {
  return (
    <div className="flex-1 flex justify-center items-center">
      <VerticalStack addClassName="items-center" spacing="lg">
        <VerticalStack addClassName="items-center">
          <SwitchingStack addClassName="justify-center items-center">
            <Typography variant="h2" component="h1" textAlign="center">
              {errorCode}
            </Typography>
            <SwitchingDivider className="max-md:w-1/2" />
            <Typography variant="h4" component="h2" textAlign="center">
              {errorText}
            </Typography>
          </SwitchingStack>
          {Boolean(errorDetails) && (
            <Typography variant="body1" component="div">
              {errorDetails}
            </Typography>
          )}
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

export default ErrorSection;
