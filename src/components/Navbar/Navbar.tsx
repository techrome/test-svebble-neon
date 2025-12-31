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
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FilterListIcon from "@mui/icons-material/FilterList";
import UserIcon from "@mui/icons-material/AccountCircle";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { useRouter } from "next/router";
import { Virtuoso } from "react-virtuoso";
import { motion } from "motion/react";
import {
  SubmitHandler,
  useForm,
  UseFormReturn,
  useWatch,
} from "react-hook-form";
import Fuse from "fuse.js";
import { type Dayjs } from "dayjs";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { nanoid } from "@reduxjs/toolkit";

import {
  useGlobalDrawer,
  useLocalModal,
  useLocalPopover,
} from "@/utils/useOverlay";
import {
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import Link from "@/components/Link/Link";
import Label from "@/components/Label/Label";
import { privateRoutePrefix, ROUTES } from "@/utils/routes";
import { Divider } from "@/components/Layout/Dividers";
import IconButton from "@/components/Button/IconButton";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import Snackbar from "@/components/Snackbar/Snackbar";
import Tabs from "@/components/Tabs/Tabs";
import {
  deleteAllSystemNotifications,
  readAllSystemNotifications,
  type Snackbar as SnackbarType,
} from "@/redux/slices/snackbars";
import Tooltip from "@/components/Tooltip/Tooltip";
import Input from "@/components/Fields/Input";
import Badge from "@/components/Badge/Badge";
import Button from "@/components/Button/Button";
import { countMeaningfulValues } from "@/utils/countMeaningfulValues";
import DateTimePicker from "@/components/Fields/DateTimePicker";
import { logger } from "@/utils/logger";
import { normalizeText } from "@/utils/stringUtils";
import dayjs from "@/utils/dayjs";
import { Text } from "@/utils/validators/helpers/text";
import { isWithinMinute } from "@/utils/timeUtils";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import { zDayjs } from "@/utils/validators/helpers/custom";
import AuthForm, {
  AuthType,
  authTypeMapping,
} from "@/components/AuthForm/AuthForm";
import { trpc } from "@/trpc";
import { useAppSnackbar } from "@/utils/snackbar";
import useUser from "@/trpc/hooks/useUser";
import { useDebouncedValue } from "@/utils/useDebouncedValue";
import { eventHandled, eventHappened } from "@/redux/slices/misc";

const MotionItem = React.forwardRef<
  React.ComponentRef<typeof motion.div>,
  React.ComponentPropsWithoutRef<typeof motion.div>
>((props, ref) => (
  <motion.div ref={ref} layout transition={{ duration: 0.2 }} {...props} />
));

const AuthButtons = (props: { fullWidth?: boolean; isNavbar?: boolean }) => {
  const [authType, setAuthType] = React.useState<AuthType>("login");
  const authModal = useLocalModal();
  const { addAppSnackbar } = useAppSnackbar();
  const router = useRouter();
  const isPrivatePage = router.pathname.startsWith(`/${privateRoutePrefix}`);
  const user = useUser();
  const utils = trpc.useUtils();

  const moveFromPrivatePage = () => {
    if (isPrivatePage) {
      router.push(ROUTES.home);
    }
  };

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess() {
      moveFromPrivatePage();
      utils.auth.user.setData(undefined, { user: null });
      utils.auth.user.invalidate();
    },
  });
  const deleteAccountMutation = trpc.auth.deleteUser.useMutation({
    onSuccess() {
      moveFromPrivatePage();
      utils.auth.user.setData(undefined, { user: null });
      utils.auth.user.invalidate();
      addAppSnackbar({
        message: "Your account has been deleted",
        variant: "success",
      });
    },
  });

  return (
    <>
      {user.isPending ? (
        <CircularProgress size={24} />
      ) : user.data?.user ? (
        props.isNavbar ? null : (
          <VerticalStack spacing="md">
            <Typography variant="body1" textAlign="center">
              Hello, <strong>{user.data.user.name}</strong>!
            </Typography>

            <VerticalStack>
              <Link href={ROUTES.private_myProfile} color="textPrimary">
                <Button
                  variant="contained"
                  color="inherit"
                  size="large"
                  fullWidth
                  startIcon={<PersonIcon />}
                >
                  My Profile
                </Button>
              </Link>
              <Link href={ROUTES.private_settings} color="textPrimary">
                <Button
                  variant="contained"
                  color="inherit"
                  size="large"
                  fullWidth
                  startIcon={<SettingsIcon />}
                >
                  Settings
                </Button>
              </Link>
              <Divider className="my-2" />
              <Button
                variant="contained"
                onClick={() => {
                  logoutMutation.mutate();
                }}
                color="inherit"
                className=""
                size="large"
                fullWidth
                disabled={deleteAccountMutation.isPending}
                isLoading={logoutMutation.isPending}
                startIcon={<LogoutIcon />}
              >
                Log out
              </Button>
            </VerticalStack>

            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                deleteAccountMutation.mutate();
              }}
              size="large"
              fullWidth
              disabled={logoutMutation.isPending}
              isLoading={deleteAccountMutation.isPending}
            >
              Delete my account
            </Button>
          </VerticalStack>
        )
      ) : (
        <HorizontalStack
          addClassName={clsx("items-center", props.isNavbar && "max-md:hidden")}
          wrap={false}
        >
          <Button
            variant="outlined"
            onClick={() => {
              setAuthType("login");
              authModal.openModal();
            }}
            size="large"
            fullWidth={props.fullWidth}
          >
            Log in
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setAuthType("signup");
              authModal.openModal();
            }}
            size="large"
            fullWidth={props.fullWidth}
          >
            Sign up
          </Button>
        </HorizontalStack>
      )}
      <authModal.ReadyComponent title={authTypeMapping[authType]}>
        <AuthForm
          initialAuthType={authType}
          onAuthTypeChange={setAuthType}
          onSuccess={authModal.closeModal}
        />
      </authModal.ReadyComponent>
    </>
  );
};

const DrawerContent = () => {
  const { mode, setMode } = useColorScheme();
  const modeLabelId = useId();

  return (
    <VerticalStack withPadding addClassName="flex-1 overflow-y-auto">
      <LoadingBoundary isOuter>
        <AuthButtons fullWidth />
      </LoadingBoundary>

      <div className="mt-auto">
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
      </div>
      <Divider />
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
  news: "news",
  system: "system",
};
type NotificationTabs = keyof typeof notificationTabsMapping;

const timePresets = [
  {
    id: "1",
    label: "Last 5 minutes",
    getTime: (now) => now.subtract(5, "minutes"),
  },
  {
    id: "2",
    label: "Last 30 minutes",
    getTime: (now) => now.subtract(30, "minutes"),
  },
  {
    id: "3",
    label: "Last hour",
    getTime: (now) => now.subtract(1, "hour"),
  },
  {
    id: "4",
    label: "Last 2 hours",
    getTime: (now) => now.subtract(2, "hours"),
  },
  {
    id: "5",
    label: "Last 24 hours",
    getTime: (now) => now.subtract(24, "hours"),
  },
] satisfies { id: string; label: string; getTime: (now: Dayjs) => Dayjs }[];

const filterSchemaForm = z
  .object({
    searchText: Text.Long(),
    startDate: zDayjs.nullable(),
    endDate: zDayjs.nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate.isBefore(v.startDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End time must be after start time",
      });
    }
  });

type FilterValues = z.infer<typeof filterSchemaForm>;

const emptyFilter: FilterValues = {
  searchText: "",
  startDate: null,
  endDate: null,
};

const FilterForm = ({
  onSubmit,
  onClear,
  formState,
}: {
  onSubmit: SubmitHandler<FilterValues>;
  onClear: React.EventHandler<React.SyntheticEvent>;
  formState: UseFormReturn<FilterValues>;
}) => {
  const [startDate, endDate] = useWatch({
    control: formState.control,
    name: ["startDate", "endDate"],
  });
  logger.log({ startDate, endDate });

  const now = dayjs();

  return (
    <Section addClassName="w-sm max-w-full">
      <form onSubmit={formState.handleSubmit(onSubmit)} noValidate>
        <Label>Filter notifications</Label>
        <VerticalStack>
          <Input
            control={formState.control}
            name="searchText"
            label="Search"
            type="text"
            fullWidth
            autoFocus
            endAccessory="clear"
          />
          <DateTimePicker
            control={formState.control}
            name="startDate"
            label="Start time"
            maxDateTime={endDate || undefined}
          />
          <DateTimePicker
            control={formState.control}
            name="endDate"
            label="End time"
            minDateTime={startDate || undefined}
          />
          <div className="mb-5">
            <Label>Time presets</Label>
            <HorizontalStack>
              {timePresets.map((preset) => (
                <Button
                  key={preset.id}
                  variant={
                    startDate && isWithinMinute(preset.getTime(now), startDate)
                      ? "contained"
                      : "outlined"
                  }
                  onClick={() => {
                    formState.setValue("startDate", preset.getTime(dayjs()));
                    formState.setValue("endDate", null, {
                      shouldValidate: true,
                    });
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </HorizontalStack>
          </div>
          <HorizontalStack addClassName="w-full justify-between">
            <Button type="button" variant="outlined" onClick={onClear}>
              Clear
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Apply
            </Button>
          </HorizontalStack>
        </VerticalStack>
      </form>
    </Section>
  );
};

const SearchOutsideForm = ({
  formState,
  handleSubmit,
  filterPopover,
  onDebouncedValue,
}: {
  formState: UseFormReturn<FilterValues>;
  handleSubmit: SubmitHandler<FilterValues>;
  filterPopover: ReturnType<typeof useLocalPopover>;
  onDebouncedValue: (val: string) => void;
}) => {
  const [searchText] = useWatch({
    control: formState.control,
    name: ["searchText"],
  });

  const debouncedSearchText = useDebouncedValue(searchText, 300, {
    instantOnFalsyValue: true,
  });

  React.useEffect(() => {
    if (filterPopover.isOpen) {
      return;
    }
    onDebouncedValue(debouncedSearchText);
  }, [debouncedSearchText, filterPopover.isOpen]);

  return (
    <form onSubmit={formState.handleSubmit(handleSubmit)} noValidate>
      <Input
        control={formState.control}
        name="searchText"
        label="Search"
        type="text"
        withHelperText={false}
        className="w-3xs"
        endAccessory="clear"
      />
    </form>
  );
};

const SystemNotifications = () => {
  const [filter, setFilter] = React.useState<FilterValues>(emptyFilter);

  const systemNotifications = useAppSelector(
    (state) => state.snackbars.systemNotifications
  );
  const dispatch = useAppDispatch();
  const filterPopover = useLocalPopover();

  const isLargeScreen = useMediaQuery((theme) => theme.breakpoints.up("sm"));

  const filterFormState = useForm<FilterValues>({
    defaultValues: emptyFilter,
    resolver: zodResolver(filterSchemaForm),
  });
  const fuse = React.useMemo(
    () =>
      new Fuse(systemNotifications, {
        keys: [
          "messageStringified",
          "detailsStringified",
          "variant",
        ] satisfies (keyof SnackbarType)[],
        ignoreLocation: true,
        includeScore: false,
      }),
    [systemNotifications]
  );

  const filteredNotifications = React.useMemo(() => {
    let result: SnackbarType[] = systemNotifications;
    const searchText = normalizeText(filter.searchText);
    if (searchText) {
      const searchResult = fuse.search(searchText);
      result = searchResult.map((r) => r.item);
    }
    if (filter.startDate) {
      result = result.filter((item) =>
        dayjs(item.createdAt).isAfter(filter.startDate)
      );
    }
    if (filter.endDate) {
      result = result.filter((item) =>
        dayjs(item.createdAt).isBefore(filter.endDate)
      );
    }
    return result;
  }, [fuse, systemNotifications, filter]);

  const activeFilterCount = React.useMemo(
    () => countMeaningfulValues(filter),
    [filter]
  );

  const handleFilterSubmit: SubmitHandler<FilterValues> = (values) => {
    setFilter(values);
    filterPopover.closePopover();
  };

  const handleClearFilter = () => {
    setFilter(emptyFilter);
    filterFormState.reset();
    filterPopover.closePopover();
  };

  React.useEffect(() => {
    dispatch(readAllSystemNotifications());
  }, []);

  return (
    <Box>
      <HorizontalStack addClassName="py-2 justify-between">
        <HorizontalStack addClassName="items-center">
          <Typography variant="body1">
            {filteredNotifications.length === systemNotifications.length ? (
              ""
            ) : (
              <>
                <Typography
                  variant="body1"
                  component="span"
                  color="warning"
                  className="font-bold"
                >
                  {filteredNotifications.length}
                </Typography>{" "}
                out of{" "}
              </>
            )}
            {systemNotifications.length} notifications
          </Typography>
          <Tooltip title="Delete all notifications">
            <IconButton
              size="large"
              color="inherit"
              aria-label="delete all notifications"
              disabled={systemNotifications.length === 0}
              onClick={() => {
                dispatch(deleteAllSystemNotifications());
              }}
            >
              <DeleteSweepIcon />
            </IconButton>
          </Tooltip>
        </HorizontalStack>
        <HorizontalStack addClassName="items-center">
          {isLargeScreen && (
            <SearchOutsideForm
              filterPopover={filterPopover}
              formState={filterFormState}
              handleSubmit={handleFilterSubmit}
              onDebouncedValue={async (searchText) => {
                const isValid = await filterFormState.trigger("searchText");
                if (isValid) {
                  setFilter((prev) => ({
                    ...prev,
                    searchText,
                  }));
                }
              }}
            />
          )}
          <Tooltip title="Filter notifications">
            <IconButton
              size="large"
              color="inherit"
              aria-label="filter notifications"
              onClick={filterPopover.openPopover}
            >
              <Badge badgeContent={activeFilterCount}>
                <FilterListIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </HorizontalStack>
      </HorizontalStack>
      <Virtuoso
        style={{ height: "500px", width: "100%" }}
        increaseViewportBy={{ bottom: 150, top: 150 }}
        data={filteredNotifications}
        components={{
          List: VerticalStack,
          Item: MotionItem,
        }}
        computeItemKey={(_, item) => item.id}
        itemContent={(_, systemNotification) => {
          return <Snackbar isSystemNotification {...systemNotification} />;
        }}
      />
      <filterPopover.ReadyComponent
        onClose={() => {
          filterFormState.reset(filter, { keepDefaultValues: true });
        }}
      >
        <FilterForm
          formState={filterFormState}
          onSubmit={handleFilterSubmit}
          onClear={handleClearFilter}
        />
      </filterPopover.ReadyComponent>
    </Box>
  );
};

const NotificationsContent = () => {
  const [selectedNotificationsTab, setSelectedNotificationsTab] =
    React.useState<NotificationTabs>("normal");
  const unreadSystemNotificationsCount = useAppSelector(
    (state) =>
      state.snackbars.systemNotifications.filter((snack) => !snack.isRead)
        .length
  );

  return (
    <LoadingBoundary>
      <Section fullWidth={false} addClassName="w-2xl max-w-full">
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
              value: notificationTabsMapping.news,
              label: notificationTabsMapping.news,
              panel: "Imporant panel",
            },
            {
              value: notificationTabsMapping.system,
              label: (
                <Badge badgeContent={unreadSystemNotificationsCount}>
                  <div className="p-1">{notificationTabsMapping.system}</div>
                </Badge>
              ),
              panel: <SystemNotifications />,
            },
          ]}
        />
      </Section>
    </LoadingBoundary>
  );
};

const NavbarInner = () => {
  const { openDrawer, closeDrawer } = useGlobalDrawer();
  const router = useRouter();

  const notificationsPopover = useLocalPopover();
  const user = useUser();
  const userData = user.data?.user;
  const utils = trpc.useUtils();

  const authenticatedEvent = useAppSelector(
    (state) => state.misc.events.hasAuthenticated
  );
  const authenticatedOnFirstVisitEvent = useAppSelector(
    (state) => state.misc.events.hasAuthenticatedOnFirstVisit
  );

  const dispatch = useAppDispatch();
  const { addAppSnackbar, closeAppSnackbar } = useAppSnackbar();

  useEffect(() => {
    if (userData && !authenticatedOnFirstVisitEvent.happenedAtMs) {
      dispatch(
        eventHappened("hasAuthenticatedOnFirstVisit", { happenedAtMs: 1 }) // make it always older than user timestamp
      );
    }
  }, [authenticatedOnFirstVisitEvent, userData]);

  useEffect(() => {
    const anyAuthUnhandledEvent =
      authenticatedEvent.happenedAtMs && !authenticatedEvent.wasHandled
        ? authenticatedEvent
        : authenticatedOnFirstVisitEvent;
    if (
      anyAuthUnhandledEvent.happenedAtMs &&
      !anyAuthUnhandledEvent.wasHandled &&
      user.dataUpdatedAt > anyAuthUnhandledEvent.happenedAtMs &&
      userData &&
      !user.isFetching
    ) {
      if (
        !userData.emailVerified &&
        userData.pendingEmail &&
        userData.pendingEmail !== userData.email
      ) {
        const snackbarId = nanoid();
        addAppSnackbar({
          id: snackbarId,
          message: (
            <HorizontalStack addClassName="items-center">
              Please verify your email
              <Link href={ROUTES.private_myProfile} color="textPrimary">
                <Button
                  onClick={() => {
                    closeAppSnackbar(snackbarId);
                  }}
                  variant="outlined"
                >
                  Verify
                </Button>
              </Link>
            </HorizontalStack>
          ),
          variant: "warning",
          durationMs: 0,
        });
      }

      if (userData.username) {
        utils.auth.checkUsernameAvailability.invalidate({
          username: userData?.username,
        });
      }
      dispatch(eventHandled("hasAuthenticated"));
      dispatch(eventHandled("hasAuthenticatedOnFirstVisit"));
    }
  }, [
    authenticatedEvent,
    authenticatedOnFirstVisitEvent,
    userData,
    user.isFetching,
    user.dataUpdatedAt,
  ]);

  useEffect(() => {
    router.events.on("routeChangeComplete", closeDrawer);
    router.events.on("hashChangeComplete", closeDrawer);
    return () => {
      router.events.off("routeChangeComplete", closeDrawer);
      router.events.off("hashChangeComplete", closeDrawer);
    };
  }, [router.events, closeDrawer]);

  return (
    <Toolbar className="flex justify-between py-2 sm:py-3">
      <Link href={ROUTES.home} className="logo">
        <Typography variant="h5" component="div" color="textPrimary">
          ChatApp
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
        <notificationsPopover.ReadyComponent transitionDuration={0}>
          <NotificationsContent />
        </notificationsPopover.ReadyComponent>
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
          {user.data?.user ? <UserIcon /> : <MenuIcon />}
        </IconButton>
      </HorizontalStack>
    </Toolbar>
  );
};

const Navbar = () => {
  return (
    <AppBar position="sticky" color="default">
      <LoadingBoundary>
        <NavbarInner />
      </LoadingBoundary>
    </AppBar>
  );
};

export default Navbar;
