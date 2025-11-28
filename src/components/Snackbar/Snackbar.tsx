import React from "react";
import { CustomContentProps, useSnackbar } from "notistack";
import { Alert, Box, Collapse, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import clsx from "clsx";

import { HorizontalStack } from "@/components/Layout/Containers";
import IconButton from "@/components/Button/IconButton";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useSnackbarProgressTimer } from "@/components/Snackbar/useSnackbarProgressTimer";
import { SnackProgressBar } from "@/components/Snackbar/SnackbarProgress";

type Props = CustomContentProps;

const Snackbar = React.forwardRef<HTMLDivElement, Props>(
  function SnackbarInner(props, ref) {
    const hasDetails = Boolean(props.details);
    const hasDuration = Boolean(props.durationMs);
    const [expanded, setExpanded] = React.useState(false);
    const { closeSnackbar } = useSnackbar();
    const { eventHandlers, isRunning } = useSnackbarProgressTimer({
      shouldAutoRun: hasDuration,
    });
    const tooltipExpandLabel = expanded ? "Hide details" : "Show details";

    return (
      <Alert
        ref={ref}
        variant="standard"
        severity={props.variant}
        {...eventHandlers}
      >
        {Boolean(hasDuration) && (
          <SnackProgressBar
            durationMs={props.durationMs!}
            isRunning={isRunning}
            onComplete={() => {
              closeSnackbar(props.id);
            }}
          />
        )}
        <HorizontalStack
          fullWidth
          addClassName="justify-between items-center max-sm:flex-nowrap"
        >
          <Typography variant="body1">{props.message}</Typography>

          <HorizontalStack addClassName="max-sm:flex-nowrap">
            {hasDetails && (
              <Tooltip title={tooltipExpandLabel}>
                <IconButton
                  onClick={() => setExpanded((x) => !x)}
                  aria-label={tooltipExpandLabel}
                  color="inherit"
                >
                  <ExpandMoreIcon
                    className={clsx(
                      expanded ? "rotate-180" : "rotate-0",
                      "transition-all"
                    )}
                  />
                </IconButton>
              </Tooltip>
            )}
            <IconButton
              aria-label="Close"
              onClick={() => {
                closeSnackbar(props.id);
              }}
              color="inherit"
            >
              <CloseIcon />
            </IconButton>
          </HorizontalStack>
        </HorizontalStack>
        {hasDetails && (
          <Collapse in={expanded} unmountOnExit>
            <Box className="mt-2 pr-3 max-w-full max-h-[200px] overflow-y-auto">
              <Typography variant="body2">{props.details}</Typography>
            </Box>
          </Collapse>
        )}
      </Alert>
    );
  }
);

export default Snackbar;
