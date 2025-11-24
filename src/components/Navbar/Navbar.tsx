import React, { useEffect, useId } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useColorScheme,
  ToggleButtonGroup,
  ToggleButton,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";

import { useGlobalDrawer } from "@/utils/useOverlay";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import Link from "@/components/Link/Link";
import Button from "@/components/Button/Button";
import Label from "@/components/Label/Label";
import { ROUTES } from "@/utils/routes";
import { useRouter } from "next/router";
import { Divider } from "@/components/Layout/Dividers";

const DrawerContent = () => {
  const { mode, setMode } = useColorScheme();
  const modeLabelId = useId();

  return (
    <VerticalStack withPadding addClassName="flex-1 overflow-y-auto">
      <Box>
        <Label id={modeLabelId}>Mode</Label>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(ev, newMode) => {
            setMode(newMode || mode);
          }}
          aria-label="mode"
          aria-describedby={modeLabelId}
          className="flex"
        >
          {[
            {
              value: "system",
              label: "System",
              ariaLabel: "system mode",
              Icon: SettingsBrightnessIcon,
            },
            {
              value: "light",
              label: "Light",
              ariaLabel: "light mode",
              Icon: LightModeIcon,
            },
            {
              value: "dark",
              label: "Dark",
              ariaLabel: "dark mode",
              Icon: DarkModeIcon,
            },
          ].map((info, i) => (
            <ToggleButton
              className="flex-1"
              key={i}
              value={info.value}
              aria-label={info.ariaLabel}
            >
              <HorizontalStack addClassName="justify-center">
                <info.Icon />
                {info.label}
              </HorizontalStack>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Divider className="mt-auto" />
      <List disablePadding>
        {[
          {
            label: "About Us",
            url: ROUTES.about,
          },
          {
            label: "Terms and Conditions",
            url: ROUTES.terms,
          },
          {
            label: "Privacy Policy",
            url: ROUTES.privacyPolicy,
          },
        ].map((info, i) => (
          <ListItem key={i} disablePadding>
            <Link href={info.url} className="w-full">
              <ListItemButton>
                <ListItemText primary={info.label} className="text-left" />
              </ListItemButton>
            </Link>
          </ListItem>
        ))}
      </List>
    </VerticalStack>
  );
};

const Navbar = () => {
  const { openDrawer, closeDrawer } = useGlobalDrawer();
  const router = useRouter();

  useEffect(() => {
    router.events.on("routeChangeComplete", closeDrawer);
    router.events.on("hashChangeComplete", closeDrawer);
    return () => {
      router.events.off("routeChangeComplete", closeDrawer);
      router.events.off("hashChangeComplete", closeDrawer);
    };
  }, [router.events, closeDrawer]);

  return (
    <AppBar position="sticky" color="default">
      <Toolbar className="flex justify-between py-2 sm:py-3">
        <Link href={ROUTES.home} className="logo">
          <Typography variant="h5" component="div" color="textPrimary">
            ChatApp
          </Typography>
        </Link>
        <IconButton
          size="large"
          color="inherit"
          aria-label="menu"
          onClick={() => {
            openDrawer({
              content: <DrawerContent />,
              props: { title: "Menu" },
            });
          }}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
