import React from "react";
import {
  Tooltip as MuiTooltip,
  TooltipProps as MuiTooltipProps,
  Typography,
} from "@mui/material";

type TooltipProps = MuiTooltipProps;

const Tooltip = ({ children, ...props }: TooltipProps) => {
  return (
    <MuiTooltip
      placement="top"
      arrow
      enterDelay={300}
      {...props}
      title={<Typography variant="body1">{props.title}</Typography>}
    >
      {children}
    </MuiTooltip>
  );
};

export default Tooltip;
