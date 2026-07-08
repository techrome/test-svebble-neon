import React from "react";
import { IconButton as MuiIconButton } from "@mui/material";

const IconButton = React.forwardRef(({ ...props }, ref) => {
  return <MuiIconButton ref={ref} {...props} />;
}) as typeof MuiIconButton;

export default IconButton;
