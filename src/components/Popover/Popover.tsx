import React from "react";
import { Popover as MuiPopover, PopoverProps } from "@mui/material";

type Props = PopoverProps;

const Popover = ({ children, ...props }: Props) => {
  return (
    <MuiPopover
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      {...props}
    >
      {children}
    </MuiPopover>
  );
};

export default Popover;
