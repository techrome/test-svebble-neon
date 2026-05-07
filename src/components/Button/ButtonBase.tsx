import React from "react";
import MuiButtonBase from "@mui/material/ButtonBase";

// doing this to preserve MUI typing properly

const ButtonBase = React.forwardRef((props, ref) => {
  return <MuiButtonBase ref={ref} {...props} />;
}) as typeof MuiButtonBase;

export default ButtonBase;
