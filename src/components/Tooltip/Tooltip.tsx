import React from "react";
import {
  Tooltip as MuiTooltip,
  TooltipProps as MuiTooltipProps,
  Typography,
} from "@mui/material";

type TooltipProps = MuiTooltipProps;

const Tooltip = ({ children, ...props }: TooltipProps) => {
  const isChildDisabled = Boolean(
    (React.Children.only(children)?.props as Record<string, unknown>)?.disabled
  );

  return (
    <MuiTooltip
      placement="top"
      arrow
      enterDelay={150}
      enterTouchDelay={100}
      leaveTouchDelay={4000}
      {...props}
      title={
        props.title ? (
          <Typography className="dark" variant="body1">
            {props.title}
          </Typography>
        ) : null
      }
    >
      {isChildDisabled ? <span>{children}</span> : children}
    </MuiTooltip>
  );
};

export default Tooltip;
