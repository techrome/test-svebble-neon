import React from "react";
import { CustomContentProps, useSnackbar } from "notistack";
import { Alert, Box, Collapse, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import clsx from "clsx";

import { HorizontalStack } from "@/components/Layout/Containers";
import IconButton from "@/components/Button/IconButton";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useSnackbarProgressTimer } from "@/components/Snackbar/useSnackbarProgressTimer";
import { SnackProgressBar } from "@/components/Snackbar/SnackbarProgress";
import { useAppDispatch } from "@/redux/hooks";
import {
  deleteSystemNotification,
  type Snackbar as SnackbarType,
} from "@/redux/slices/snackbars";
import dayjs from "@/utils/dayjs";
import { dateTimeFormatFullDisplay } from "@/utils/dateFormats";
import { useRerenderOnInterval } from "@/utils/useRerenderOnInterval";

type SnackbarProps = {
  isSystemNotification?: false | undefined;
} & Omit<CustomContentProps, "key">;
type SystemNotificationProps = {
  isSystemNotification: true;
} & SnackbarType &
  Omit<
    CustomContentProps,
    "style" | "anchorOrigin" | "hideIconVariant" | "iconVariant" | "key"
  >;
type Props = SnackbarProps | SystemNotificationProps;

const AutoRefreshingTime = ({ createdAt }: Pick<Props, "createdAt">) => {
  useRerenderOnInterval();

  return (
    <Tooltip title={dayjs(createdAt).format(dateTimeFormatFullDisplay)}>
      <Typography variant="caption">{dayjs(createdAt).fromNow()}</Typography>
    </Tooltip>
  );
};

const Snackbar = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
  const hasDetails = Boolean(props.details);
  const hasDuration = props.isSystemNotification
    ? false
    : Boolean(props.durationMs);
  const [expanded, setExpanded] = React.useState(false);
  const { closeSnackbar } = useSnackbar();
  const { eventHandlers, isRunning } = useSnackbarProgressTimer({
    shouldAutoRun: hasDuration,
  });
  const tooltipExpandLabel = expanded ? "Hide details" : "Show details";
  const dispatch = useAppDispatch();

  return (
    <Alert
      ref={ref}
      variant="standard"
      severity={props.variant}
      className={
        props.isSystemNotification && !props.isRead
          ? "border border-(--mui-palette-warning-main)"
          : ""
      }
      {...eventHandlers}
    >
      {hasDuration && (
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
        addClassName="justify-between items-center flex-nowrap!"
      >
        <div>
          {props.isSystemNotification && (
            <AutoRefreshingTime createdAt={props.createdAt} />
          )}

          <Typography
            variant="body1"
            component="div"
            className="max-h-[100px] overflow-y-auto"
          >
            {props.message}
          </Typography>
        </div>

        <HorizontalStack addClassName="flex-nowrap!">
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
          {props.isSystemNotification ? (
            <IconButton
              aria-label="Delete"
              onClick={() => {
                dispatch(deleteSystemNotification(props.id));
              }}
              color="inherit"
            >
              <DeleteIcon />
            </IconButton>
          ) : (
            <IconButton
              aria-label="Close"
              onClick={() => {
                closeSnackbar(props.id);
              }}
              color="inherit"
            >
              <CloseIcon />
            </IconButton>
          )}
        </HorizontalStack>
      </HorizontalStack>
      {hasDetails && (
        <Collapse in={expanded} unmountOnExit>
          <Box className="mt-2 pr-3 max-w-full max-h-[250px] overflow-y-auto">
            <Typography variant="body2" component="div">
              {props.details}
            </Typography>
          </Box>
        </Collapse>
      )}
    </Alert>
  );
});

export default Snackbar;
