import React from "react";
import { Popover as MuiPopover, PopoverProps } from "@mui/material";

type Props = PopoverProps;

const Popover = ({ children, ...props }: Props) => {
  return <MuiPopover {...props}>{children}</MuiPopover>;
};

export default Popover;
