import React from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import {
  Link as MuiLink,
  type LinkProps as MuiLinksProps,
} from "@mui/material";

import { AllRoutes, ANCHORS } from "@/utils/routes";

type NextLinkHrefUrlObject = Exclude<NextLinkProps["href"], string>;
type UrlObjectWithAllRoutes = Omit<
  NextLinkHrefUrlObject,
  "pathname" | "hash"
> & {
  pathname: AllRoutes;
  hash?: (typeof ANCHORS)[keyof typeof ANCHORS];
};

type Props = {
  children: React.ReactNode;
} & Omit<MuiLinksProps, "component" | "href"> &
  Omit<NextLinkProps, "href"> & {
    href: AllRoutes | UrlObjectWithAllRoutes;
  };

const Link = ({ children, ...props }: Props) => {
  return (
    <MuiLink component={NextLink} {...props}>
      {children}
    </MuiLink>
  );
};

export default Link;
