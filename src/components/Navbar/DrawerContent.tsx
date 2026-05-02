import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Typography,
  useColorScheme,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FilterListIcon from "@mui/icons-material/FilterList";
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
import z from "@/utils/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";

import { useGlobalDrawer, useLocalPopover } from "@/utils/hooks/useOverlay";
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
import { normalizeText } from "@/utils/stringUtils";
import dayjs from "@/utils/dayjs";
import { Text } from "@/utils/validators/helpers/text";
import { isWithinMinute } from "@/utils/timeUtils";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import { zDayjs } from "@/utils/validators/helpers/custom";
import { trpc } from "@/trpc";
import { useAppSnackbar } from "@/utils/snackbar";
import { useUser } from "@/trpc/hooks/useUser";
import { useDebouncedValue } from "@/utils/hooks/useDebouncedValue";
import { useQueryClient } from "@tanstack/react-query";
import { userLogoutLifecycle } from "@/trpc/helpers/userLifecycle";
import { useAuthModal } from "@/utils/hooks/useAuthModal";
import UserAvatar from "@/components/Avatar/UserAvatar";

const MotionItem = React.forwardRef<
  React.ComponentRef<typeof motion.div>,
  React.ComponentPropsWithoutRef<typeof motion.div>
>((props, ref) => (
  <motion.div ref={ref} layout transition={{ duration: 0.2 }} {...props} />
));

export const AuthButtons = (props: {
  fullWidth?: boolean;
  isNavbar?: boolean;
}) => {
  const { closeDrawer } = useGlobalDrawer();
  const authModal = useAuthModal();
  const { addAppSnackbar } = useAppSnackbar();
  const router = useRouter();
  const isPrivatePage = router.pathname.startsWith(`/${privateRoutePrefix}`);
  const user = useUser();
  const qc = useQueryClient();

  const moveFromPrivatePage = () => {
    if (isPrivatePage) {
      router.push(ROUTES.home);
    }
  };

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess() {
      moveFromPrivatePage();
      closeDrawer();
      addAppSnackbar({
        message: "You have logged out.",
      });
      userLogoutLifecycle(qc);
    },
  });
  const deleteAccountMutation = trpc.user.deleteUser.useMutation({
    onSuccess() {
      moveFromPrivatePage();
      addAppSnackbar({
        message: "Your account has been deleted.",
        variant: "success",
      });
      userLogoutLifecycle(qc);
    },
  });

  return (
    <>
      {user.isPending ? (
        <CircularProgress size={24} />
      ) : user.data?.user ? (
        props.isNavbar ? null : (
          <VerticalStack spacing="md">
            <HorizontalStack
              wrap={false}
              addClassName="items-center justify-center"
            >
              <UserAvatar user={user.data.user} size="md" />
              <div>
                <Typography variant="body1">
                  <strong>{user.data.user.name}</strong>
                </Typography>
                <Typography
                  color="textSecondary"
                  variant="subtitle2"
                  component="div"
                >
                  {user.data.user.displayUsername}
                </Typography>
              </div>
            </HorizontalStack>

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
        >
          {!props.isNavbar && <Label className="mb-0">Authorization</Label>}
          <Button
            variant="outlined"
            onClick={() => {
              authModal.openModal("login");
            }}
            size="large"
            fullWidth={props.fullWidth}
          >
            Log in
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              authModal.openModal("signup");
            }}
            size="large"
            fullWidth={props.fullWidth}
          >
            Sign up
          </Button>
        </HorizontalStack>
      )}
    </>
  );
};

export const DrawerContent = () => {
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
        path: ["endDate"] satisfies (keyof typeof v)[],
        message: "To (time) must be after From (time)",
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
            autoComplete="off"
            endAccessory="clear"
          />
          <DateTimePicker
            control={formState.control}
            name="startDate"
            label="From (time)"
            maxDateTime={endDate || undefined}
          />
          <DateTimePicker
            control={formState.control}
            name="endDate"
            label="To (time)"
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

  useEffect(() => {
    if (filterPopover.isOpen) {
      return;
    }
    onDebouncedValue(debouncedSearchText);
    // eslint-disable-next-line
  }, [debouncedSearchText, filterPopover.isOpen]);

  return (
    <form onSubmit={formState.handleSubmit(handleSubmit)} noValidate>
      <Input
        control={formState.control}
        name="searchText"
        label="Search"
        type="text"
        className="w-3xs"
        endAccessory="clear"
        autoComplete="off"
      />
    </form>
  );
};

const SystemNotifications = () => {
  const [filter, setFilter] = useState<FilterValues>(emptyFilter);

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
  const fuse = useMemo(
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

  const filteredNotifications = useMemo(() => {
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

  const activeFilterCount = useMemo(
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

  useEffect(() => {
    dispatch(readAllSystemNotifications());
    // eslint-disable-next-line
  }, []);

  return (
    <div>
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
      <div className="h-[500px] max-h-full">
        <Virtuoso
          style={{ height: "100%", width: "100%" }}
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
      </div>
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
    </div>
  );
};

export const NotificationsContent = () => {
  const [selectedNotificationsTab, setSelectedNotificationsTab] =
    useState<NotificationTabs>("normal");
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
              panel: "News panel",
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
