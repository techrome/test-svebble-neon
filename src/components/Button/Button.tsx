import React from "react";
import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
} from "@mui/material";

type Props = MuiButtonProps;

const Button = ({ children, ...props }: Props) => {
  return <MuiButton {...props}>{children}</MuiButton>;
};

export default Button;
