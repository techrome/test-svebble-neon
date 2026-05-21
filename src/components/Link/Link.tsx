import React, { useMemo } from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import {
  Link as MuiLink,
  type LinkProps as MuiLinksProps,
} from "@mui/material";
import { useRouter } from "next/router";

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
  disabled?: boolean;
} & Omit<MuiLinksProps, "component" | "href"> &
  Omit<NextLinkProps, "href"> & {
    href: AllRoutes | UrlObjectWithAllRoutes;
  };

const Link = ({ children, disabled, href, ...props }: Props) => {
  const router = useRouter();

  const resolvedHref = useMemo(
    () =>
      typeof href === "string" && (href.startsWith("?") || href.startsWith("#"))
        ? `${router.asPath.split("?")[0]?.split("#")[0] || ""}${href}`
        : href,
    [href, router.asPath]
  );

  if (disabled) {
    return (
      <MuiLink component="span" aria-disabled tabIndex={-1} {...props}>
        {children}
      </MuiLink>
    );
  }
  return (
    <MuiLink component={NextLink} href={resolvedHref} {...props}>
      {children}
    </MuiLink>
  );
};

export default Link;
