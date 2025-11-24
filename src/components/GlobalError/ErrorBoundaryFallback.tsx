import React from "react";
import { Button, Typography } from "@mui/material";
import { FallbackProps } from "react-error-boundary";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";

import { Section, VerticalStack } from "@/components/Layout/Containers";
import Tooltip from "@/components/Tooltip/Tooltip";

type ErrorBoundaryFallbackProps = FallbackProps;

const ErrorBoundaryFallback = ({
  error,
  resetErrorBoundary,
}: ErrorBoundaryFallbackProps) => {
  return (
    <Section addClassName="min-h-dvh flex flex-col justify-center items-center">
      <VerticalStack addClassName="items-center" spacing="md">
        <ErrorIcon color="error" className="text-7xl md:text-9xl" />
        <Typography variant="h2" component="h1" textAlign="center">
          UI error occured
        </Typography>
        <Typography variant="h4" component="h2" textAlign="center">
          Error message: {error?.message || "No error message"}
        </Typography>
        <Tooltip title="A full reload of the page. It will reset everything back but you will lose any unsaved changes">
          <Button
            variant="contained"
            color="primary"
            size="large"
            className="w-md max-w-full"
            onClick={() => {
              window.location.reload();
            }}
            endIcon={<InfoIcon />}
          >
            Reload the page
          </Button>
        </Tooltip>
        <Tooltip title="It may restore your previous state but is not guaranteed to work. In a worst-case scenario you may immediately get another UI error">
          <Button
            variant="outlined"
            color="primary"
            size="large"
            className="w-md max-w-full"
            onClick={resetErrorBoundary}
            endIcon={<InfoIcon />}
          >
            Try to recover the page
          </Button>
        </Tooltip>
        <Typography variant="h5" textAlign="center">
          Error stack trace:
        </Typography>
        <Typography
          variant="body1"
          textAlign="center"
          className="max-h-[300px] overflow-y-auto"
        >
          {error?.stack || "No error stack trace"}
        </Typography>
      </VerticalStack>
    </Section>
  );
};

export default ErrorBoundaryFallback;
