import React from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import {
  Link as MuiLink,
  type LinkProps as MuiLinksProps,
} from "@mui/material";
import { AllRoutes } from "@/utils/routes";

type Props = {
  children: React.ReactNode;
} & Omit<MuiLinksProps, "component" | "href"> &
  Omit<NextLinkProps, "href"> & {
    href: AllRoutes;
  };

const Link = ({ children, ...props }: Props) => {
  return (
    <MuiLink component={NextLink} {...props}>
      {children}
    </MuiLink>
  );
};

export default Link;
