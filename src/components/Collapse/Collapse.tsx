import React from "react";
import {
  CollapseProps,
  Collapse as MuiCollapse,
  useTheme,
} from "@mui/material";

type Props = CollapseProps;

const Collapse = ({ children, ...props }: Props) => {
  const theme = useTheme();

  return (
    <MuiCollapse
      in={props.in}
      timeout={theme.transitions.duration.shortest}
      unmountOnExit
      {...props}
    >
      {children}
    </MuiCollapse>
  );
};

export default Collapse;
