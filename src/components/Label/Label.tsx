import React from "react";
import { Typography, type TypographyProps } from "@mui/material";

type Props = TypographyProps;

const Label = ({ children, ...props }: Props) => {
  return (
    <Typography variant="body1" className="mb-1 sm:mb-2" {...props}>
      {children}
    </Typography>
  );
};

export default Label;
