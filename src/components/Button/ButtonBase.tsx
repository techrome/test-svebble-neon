import React from "react";
import {
  ButtonBase as MuiButtonBase,
  type ButtonBaseProps as MuiButtonBaseProps,
} from "@mui/material";

type Props = MuiButtonBaseProps;

const ButtonBase = ({ children, ...props }: Props) => {
  return <MuiButtonBase {...props}>{children}</MuiButtonBase>;
};

export default ButtonBase;
