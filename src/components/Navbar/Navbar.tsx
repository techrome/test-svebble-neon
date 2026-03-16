import React, { useEffect, useRef } from "react";
import { AppBar, Toolbar, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import UserIcon from "@mui/icons-material/AccountCircle";
import { useRouter } from "next/router";
import { nanoid } from "@reduxjs/toolkit";
import NextImage from "next/image";

import { useGlobalDrawer, useLocalPopover } from "@/utils/hooks/useOverlay";
import { HorizontalStack } from "@/components/Layout/Containers";
import Link from "@/components/Link/Link";
import { ROUTES, ANCHORS } from "@/utils/routes";
import IconButton from "@/components/Button/IconButton";
import Badge from "@/components/Badge/Badge";
import Button from "@/components/Button/Button";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import { trpc } from "@/trpc";
import { useAppSnackbar } from "@/utils/snackbar";
import { useUser } from "@/trpc/hooks/useUser";
import usePrevious from "@/utils/hooks/usePrevious";
import { APP_NAME } from "@/utils/constants";
import {
  AuthButtons,
  DrawerContent,
  NotificationsContent,
} from "@/components/Navbar/DrawerContent";
import { env } from "@/utils/env";
import { defaultAvatars } from "@/pages/app/my-profile";
import DefaultAvatar from "@/components/DefaultAvatar/DefaultAvatar";

const getHashId = (url: string) => {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;

  const raw = url.slice(hashIndex + 1);
  if (!raw) return null;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const NavbarInner = () => {
  const { openDrawer, closeDrawer } = useGlobalDrawer();
  const router = useRouter();
  const notificationsPopover = useLocalPopover();
  const utils = trpc.useUtils();
  const { addAppSnackbar, closeAppSnackbar } = useAppSnackbar();
  const user = useUser();
  const scrollToIdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userData = user.data?.user;
  const previousUserId = usePrevious(userData?.id);

  const hasAuthenticated =
    Boolean(userData?.id) && previousUserId !== userData?.id;

  useEffect(() => {
    const isVerifyEmailPage = router.pathname === ROUTES.verifyEmailRedirect;
    if (hasAuthenticated) {
      const snackbarId = nanoid();
      if (userData?.isAnonymous) {
        addAppSnackbar({
          id: snackbarId,
          message: (
            <HorizontalStack addClassName="items-center">
              You are logged in as Guest. This is a temporary session with
              limited capabilities. Please link your account if you want to save
              your data.
              <Link
                href={{
                  pathname: ROUTES.private_myProfile,
                  hash: ANCHORS.linkAccount,
                }}
                color="textPrimary"
              >
                <Button
                  onClick={() => {
                    closeAppSnackbar(snackbarId);
                  }}
                  variant="outlined"
                >
                  Link account
                </Button>
              </Link>
            </HorizontalStack>
          ),
          variant: "info",
          durationMs: 0,
        });
      } else if (
        !userData?.emailVerified &&
        userData?.pendingEmail &&
        userData?.pendingEmail !== userData?.email &&
        !isVerifyEmailPage
      ) {
        addAppSnackbar({
          id: snackbarId,
          message: (
            <HorizontalStack addClassName="items-center">
              Please verify your email. Accounts without a verified email have
              limited capabilities.
              <Link
                href={{
                  pathname: ROUTES.private_myProfile,
                  hash: ANCHORS.email,
                }}
                color="textPrimary"
              >
                <Button
                  onClick={() => {
                    closeAppSnackbar(snackbarId);
                  }}
                  variant="outlined"
                >
                  Verify email
                </Button>
              </Link>
            </HorizontalStack>
          ),
          variant: "info",
          durationMs: 0,
        });
      } else if (
        !userData?.pendingEmail &&
        !userData?.emailVerified &&
        !isVerifyEmailPage
      ) {
        addAppSnackbar({
          id: snackbarId,
          message: (
            <HorizontalStack addClassName="items-center">
              {
                "Please add an email so you can recover your account if you forget your password. Accounts without an email have limited capabilities."
              }
              <Link
                href={{
                  pathname: ROUTES.private_myProfile,
                  hash: ANCHORS.email,
                }}
                color="textPrimary"
              >
                <Button
                  onClick={() => {
                    closeAppSnackbar(snackbarId);
                  }}
                  variant="outlined"
                >
                  Add email
                </Button>
              </Link>
            </HorizontalStack>
          ),
          variant: "info",
          durationMs: 0,
        });
      }

      if (userData?.username) {
        utils.user.checkUsernameAvailability.invalidate(
          {
            username: userData?.username,
          },
          { refetchType: "none" }
        );
      }
    }
    // eslint-disable-next-line
  }, [hasAuthenticated]);

  useEffect(() => {
    const clearScrollToIdTimer = () => {
      if (scrollToIdTimerRef.current !== null) {
        clearTimeout(scrollToIdTimerRef.current);
      }
      scrollToIdTimerRef.current = null;
    };

    const scrollToId = (id: string) => {
      clearScrollToIdTimer();
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView();

          el.classList.remove("hash-flash");
          void el.offsetWidth; // force reflow
          el.classList.add("hash-flash");

          return;
        }
        attempts += 1;

        if (attempts < 15) {
          scrollToIdTimerRef.current = setTimeout(tryScroll, 200);
        }
      };
      tryScroll();
    };

    const handleScrollToId = (url: string) => {
      const id = getHashId(url);
      if (id) scrollToId(id);
    };

    const onNavigation = (url: string) => {
      clearScrollToIdTimer();
      closeDrawer();
      notificationsPopover.closePopover();
      handleScrollToId(url);
    };

    onNavigation(window.location.href);

    router.events.on("routeChangeComplete", onNavigation);
    router.events.on("hashChangeComplete", onNavigation);
    return () => {
      router.events.off("routeChangeComplete", onNavigation);
      router.events.off("hashChangeComplete", onNavigation);
    };
    // eslint-disable-next-line
  }, [router.events]);

  useEffect(() => {
    const navbar = document.getElementById("navbar");
    if (navbar) {
      const updateNavbarHeightCssVar = () => {
        const height = navbar.offsetHeight;
        document.documentElement.style.setProperty(
          "--navbar-height",
          `${height}px`
        );
      };

      updateNavbarHeightCssVar();

      const observer = new ResizeObserver(() => updateNavbarHeightCssVar());
      observer.observe(navbar);
      return () => {
        observer.disconnect();
      };
    }
  }, []);

  return (
    <Toolbar className="flex justify-between py-2 sm:py-3">
      <Link
        href={{
          pathname: ROUTES.home,
        }}
        className="logo"
      >
        <Typography variant="h5" component="div" color="textPrimary">
          {APP_NAME}
        </Typography>
      </Link>
      <HorizontalStack addClassName="items-center">
        <AuthButtons isNavbar />
        <LoadingBoundary>
          <IconButton
            size="large"
            color="inherit"
            aria-label="notifications"
            onClick={notificationsPopover.openPopover}
          >
            <Badge badgeContent={0}>
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </LoadingBoundary>
        <notificationsPopover.ReadyComponent
          transitionDuration={0}
          disableRestoreFocus
        >
          <NotificationsContent />
        </notificationsPopover.ReadyComponent>
        <IconButton
          size={user.data?.user ? "medium" : "large"}
          color="inherit"
          aria-label="menu"
          onClick={() => {
            openDrawer({
              content: <DrawerContent />,
              props: { title: "Menu" },
            });
          }}
        >
          {user.data?.user ? (
            <div className="relative w-8 h-8 rounded-full">
              {user.data.user.image ? (
                <NextImage
                  className="rounded-full"
                  src={`${env.NEXT_PUBLIC_CDN_URL}/${user.data.user.image}`}
                  alt="user-avatar"
                  fill
                  unoptimized
                />
              ) : (
                <DefaultAvatar
                  name={user.data.user.username}
                  seed={user.data.user.id}
                />
              )}
            </div>
          ) : (
            <MenuIcon />
          )}
        </IconButton>
      </HorizontalStack>
    </Toolbar>
  );
};

const Navbar = () => {
  return (
    <AppBar position="sticky" color="default" id="navbar">
      <LoadingBoundary>
        <NavbarInner />
      </LoadingBoundary>
    </AppBar>
  );
};

export default Navbar;
