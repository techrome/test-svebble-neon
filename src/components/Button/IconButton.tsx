import React from "react";
import {
  IconButton as MuiIconButton,
  IconButtonProps as MuiIconButtonProps,
} from "@mui/material";

type Props = MuiIconButtonProps;

const IconButton = ({ children, ...props }: Props) => {
  return <MuiIconButton {...props}>{children}</MuiIconButton>;
};

export default IconButton;
