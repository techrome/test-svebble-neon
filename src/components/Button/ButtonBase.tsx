import React from "react";
import MuiButtonBase from "@mui/material/ButtonBase";

// doing this to preserve MUI typing properly

const ButtonBase = React.forwardRef(({ focusRipple = true, ...props }, ref) => {
  return <MuiButtonBase ref={ref} focusRipple={focusRipple} {...props} />;
}) as typeof MuiButtonBase;

export default ButtonBase;
