import React from "react";
import { Typography, TypographyProps } from "@mui/material";

type Props = TypographyProps;

const Label = ({ children, ...props }: Props) => {
  return (
    <Typography variant="body1" {...props}>
      {children}
    </Typography>
  );
};

export default Label;
