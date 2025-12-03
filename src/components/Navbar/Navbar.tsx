import React, { useEffect, useId } from "react";
import {
  AppBar,
  Toolbar,
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
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useRouter } from "next/router";
import { Virtuoso } from "react-virtuoso";
import { motion } from "motion/react";

import { useGlobalDrawer } from "@/utils/useOverlay";
import {
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import Link from "@/components/Link/Link";
import Label from "@/components/Label/Label";
import { ROUTES } from "@/utils/routes";
import { Divider } from "@/components/Layout/Dividers";
import IconButton from "@/components/Button/IconButton";
import Popover from "@/components/Popover/Popover";
import { useAppSelector } from "@/redux/hooks";
import Snackbar from "@/components/Snackbar/Snackbar";
import Tabs from "@/components/Tabs/Tabs";

const MotionItem = React.forwardRef<
  React.ComponentRef<typeof motion.div>,
  React.ComponentPropsWithoutRef<typeof motion.div>
>((props, ref) => (
  <motion.div ref={ref} layout transition={{ duration: 0.2 }} {...props} />
));

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
const notificationTabsMapping = {
  normal: "normal",
  important: "important",
  system: "system",
};
type NotificationTabs = keyof typeof notificationTabsMapping;

const Navbar = () => {
  const { openDrawer, closeDrawer } = useGlobalDrawer();
  const router = useRouter();
  const notificationsId = useId();
  const [notificationsAnchorEl, setNotificationsAnchorEl] =
    React.useState<HTMLButtonElement | null>(null);
  const [selectedNotificationsTab, setSelectedNotificationsTab] =
    React.useState<NotificationTabs>("normal");
  const systemNotifications = useAppSelector(
    (state) => state.snackbars.systemNotifications
  );

  useEffect(() => {
    router.events.on("routeChangeComplete", closeDrawer);
    router.events.on("hashChangeComplete", closeDrawer);
    return () => {
      router.events.off("routeChangeComplete", closeDrawer);
      router.events.off("hashChangeComplete", closeDrawer);
    };
  }, [router.events, closeDrawer]);

  const notificationsOpen = Boolean(notificationsAnchorEl);
  const notificationsPopoverId = notificationsOpen
    ? notificationsId
    : undefined;

  return (
    <AppBar position="sticky" color="default">
      <Toolbar className="flex justify-between py-2 sm:py-3">
        <Link href={ROUTES.home} className="logo">
          <Typography variant="h5" component="div" color="textPrimary">
            ChatApp
          </Typography>
        </Link>
        <HorizontalStack>
          <IconButton
            size="large"
            color="inherit"
            aria-label="notifications"
            onClick={(e) => {
              setNotificationsAnchorEl(e.currentTarget);
            }}
          >
            <NotificationsIcon />
          </IconButton>
          <Popover
            open={notificationsOpen}
            id={notificationsPopoverId}
            anchorEl={notificationsAnchorEl}
            onClose={() => {
              setNotificationsAnchorEl(null);
            }}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "left",
            }}
            transitionDuration={0}
          >
            <Section fullWidth={false} addClassName="w-[500px] max-w-full">
              <Label>Notifications</Label>
              <Tabs
                value={selectedNotificationsTab}
                onChange={(e, value) => {
                  setSelectedNotificationsTab(value);
                }}
                variant="fullWidth"
                tabs={[
                  {
                    value: notificationTabsMapping.normal,
                    label: notificationTabsMapping.normal,
                    panel: "Normal panel",
                  },
                  {
                    value: notificationTabsMapping.important,
                    label: notificationTabsMapping.important,
                    panel: "Imporant panel",
                  },
                  {
                    value: notificationTabsMapping.system,
                    label: notificationTabsMapping.system,
                    panel: (
                      <Virtuoso
                        style={{ height: "500px", width: "100%" }}
                        increaseViewportBy={{ bottom: 150, top: 150 }}
                        data={systemNotifications}
                        components={{
                          List: VerticalStack,
                          Item: MotionItem,
                        }}
                        computeItemKey={(_, item) => item.id}
                        itemContent={(_, systemNotification) => {
                          return (
                            <Snackbar
                              isSystemNotification
                              {...systemNotification}
                            />
                          );
                        }}
                      />
                    ),
                  },
                ]}
              />
            </Section>
          </Popover>
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
        </HorizontalStack>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
