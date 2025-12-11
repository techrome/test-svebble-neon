import React from "react";
import {
  Badge as MuiBadge,
  type BadgeProps as MuiBadgeProps,
} from "@mui/material";

type Props = MuiBadgeProps;

const Badge = ({ children, ...props }: Props) => {
  return (
    <MuiBadge max={999} color="warning" {...props}>
      {children}
    </MuiBadge>
  );
};

export default Badge;
