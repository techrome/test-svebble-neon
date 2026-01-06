import React from "react";
import { Popover as MuiPopover, PopoverProps, useTheme } from "@mui/material";

type Props = PopoverProps;

const Popover = ({ children, ...props }: Props) => {
  const theme = useTheme();

  return (
    <MuiPopover
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      transitionDuration={theme.transitions.duration.shortest}
      {...props}
    >
      {children}
    </MuiPopover>
  );
};

export default Popover;
