import React from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import {
  Link as MuiLink,
  type LinkProps as MuiLinksProps,
  useTheme,
} from "@mui/material";

type Props = {
  children: React.ReactNode;
} & Omit<MuiLinksProps, "component"> &
  NextLinkProps;

const Link = ({ children, ...props }: Props) => {
  const theme = useTheme();
  return (
    <MuiLink component={NextLink} {...props}>
      {children}
    </MuiLink>
  );
};

export default Link;
