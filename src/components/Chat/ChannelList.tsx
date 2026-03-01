import React from "react";
import ViewListIcon from "@mui/icons-material/ViewList";
import clsx from "clsx";
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useRouter } from "next/router";
import { type SubmitHandler, useForm } from "react-hook-form";
import TagIcon from "@mui/icons-material/Tag";
import SettingsIcon from "@mui/icons-material/Settings";
import ReplayIcon from "@mui/icons-material/Replay";

import IconButton from "@/components/Button/IconButton";
import {
  defaultPadding,
  HorizontalStack,
  VerticalStack,
} from "@/components/Layout/Containers";
import Tooltip from "@/components/Tooltip/Tooltip";
import { RouterOutput, trpc } from "@/trpc";
import { useGlobalModal } from "@/utils/hooks/useOverlay";
import Button from "@/components/Button/Button";
import { useUser } from "@/trpc/hooks/useUser";
import {
  ChannelCreateFormValues,
  makeChannelCreateSchemaForm,
} from "@/utils/validators/shared/channels";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/Fields/Input";
import useIsDesktop from "@/utils/hooks/useIsDesktop";
import { useAppSnackbar } from "@/utils/snackbar";
import useAppQuery from "@/utils/hooks/useAppQuery";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";
import { getRouterQueryValue } from "@/utils/query";
import { Divider } from "@/components/Layout/Dividers";
import { hasPermissions } from "@/utils/hasPermissions";
import { P } from "@/utils/permissions";
import { CACHE_TIME_MS } from "@/utils/cacheTime";

type AddOrEditChannelFormSharedProps = {
  onSuccess: () => void;
};
type AddOrEditChannelFormProps = AddOrEditChannelFormSharedProps &
  (
    | {
        isEdit?: false;
      }
    | {
        isEdit: true;
        channel: RouterOutput["channels"]["get"]["items"][number];
      }
  );

const AddOrEditChannelForm = (props: AddOrEditChannelFormProps) => {
  const user = useUser();
  const isDesktop = useIsDesktop();
  const { addAppSnackbar } = useAppSnackbar();
  const channelCreateMutation = trpc.channels.create.useMutation({
    onSuccess(data) {
      addAppSnackbar({
        message: `Successfully created channel ${data.name}`,
        variant: "success",
      });
      props.onSuccess();
    },
  });
  const channelUpdateMutation = trpc.channels.update.useMutation({
    onSuccess(data) {
      addAppSnackbar({
        message: `Successfully updated channel ${data.name}`,
        variant: "success",
      });
      props.onSuccess();
    },
  });
  const deleteChannelMutation = trpc.channels.delete.useMutation({
    onSuccess() {
      addAppSnackbar({
        message: "Channel deleted",
        variant: "success",
      });
      props.onSuccess();
    },
  });

  const schema = React.useMemo(
    () => makeChannelCreateSchemaForm(user.data?.user?.emailVerified),
    [user.data?.user?.emailVerified]
  );
  const form = useForm<ChannelCreateFormValues>({
    defaultValues: { name: props.isEdit ? props.channel.name : "" },
    resolver: zodResolver(schema),
  });

  const onSubmit: SubmitHandler<ChannelCreateFormValues> = (values) => {
    if (props.isEdit) {
      channelUpdateMutation.mutate({
        id: props.channel.id,
        name: values.name,
      });
    } else {
      channelCreateMutation.mutate(values);
    }
  };
  const isSubmitting =
    channelCreateMutation.isPending ||
    channelUpdateMutation.isPending ||
    deleteChannelMutation.isPending ||
    user.isFetching;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="pt-2">
      <VerticalStack>
        <Input
          control={form.control}
          name="name"
          label="Channel name"
          type="text"
          fullWidth
          autoFocus={isDesktop}
        />
        <Button
          variant="contained"
          type="submit"
          size="large"
          isLoading={
            channelCreateMutation.isPending || channelUpdateMutation.isPending
          }
          disabled={isSubmitting}
        >
          {props.isEdit ? "Save" : "Create channel"}
        </Button>
      </VerticalStack>
      {props.isEdit ? (
        <>
          <Divider className="my-4" />
          <Button
            type="button"
            fullWidth
            variant="outlined"
            color="error"
            size="large"
            onClick={() => {
              deleteChannelMutation.mutate({ id: props.channel.id });
            }}
            isLoading={deleteChannelMutation.isPending}
            disabled={isSubmitting}
          >
            Delete channel
          </Button>
        </>
      ) : null}
    </form>
  );
};

const ChannelList = () => {
  const { closeModal, openModal } = useGlobalModal();
  const { addAppSnackbar } = useAppSnackbar();
  const channels = useAppQuery(
    trpc.channels.get.useQuery(undefined, {
      staleTime: CACHE_TIME_MS.NORMAL,
    })
  );

  const utils = trpc.useUtils();
  const router = useRouter();
  const user = useUser();
  const urlCurrentChannelId = React.useMemo(
    () => getRouterQueryValue(router.query.channelId),
    [router.query.channelId]
  );

  const canManageChannels = React.useMemo(() => {
    if (!user.data?.user) return false;

    return hasPermissions(user.data?.user, [
      P.channels.create,
      P.channels.delete,
      P.channels.update,
    ]);
  }, [user.data?.user]);

  return (
    <VerticalStack addClassName="min-h-0">
      <HorizontalStack addClassName="justify-between items-center">
        <Typography color="textSecondary">Channels</Typography>

        <Tooltip title="List of channels">
          <IconButton>
            <ViewListIcon />
          </IconButton>
        </Tooltip>
      </HorizontalStack>

      <List disablePadding className="overflow-y-auto">
        {channels.isError ? (
          <VerticalStack>
            <Typography>Failed to load channels</Typography>
            <Button
              variant="contained"
              color="inherit"
              startIcon={<ReplayIcon />}
              onClick={() => {
                utils.channels.get.invalidate();
              }}
              loading={channels.isFetching}
              fullWidth
            >
              Retry
            </Button>
          </VerticalStack>
        ) : (
          channels.data?.items.map((channel) => {
            const channelId = String(channel.id);
            const isChannelActive = channelId === urlCurrentChannelId;
            return (
              <ListItem
                key={channelId}
                disablePadding
                secondaryAction={
                  canManageChannels ? (
                    <Tooltip title="Edit channel">
                      <IconButton
                        aria-label="Edit channel"
                        onClick={() => {
                          openModal({
                            content: (
                              <AddOrEditChannelForm
                                isEdit
                                onSuccess={() => {
                                  closeModal();
                                  utils.channels.get.invalidate();
                                }}
                                channel={channel}
                              />
                            ),
                            props: { title: "Edit channel" },
                          });
                        }}
                      >
                        <SettingsIcon />
                      </IconButton>
                    </Tooltip>
                  ) : undefined
                }
              >
                <Link href={ROUTES.channels(channelId)} className="w-full">
                  <ListItemButton selected={isChannelActive}>
                    <ListItemIcon>
                      <TagIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={channel.name}
                      className="text-left"
                    />
                  </ListItemButton>
                </Link>
              </ListItem>
            );
          })
        )}
      </List>
      {canManageChannels ? (
        <>
          <Divider />
          <Button
            variant="contained"
            color="inherit"
            onClick={() => {
              openModal({
                content: (
                  <AddOrEditChannelForm
                    onSuccess={() => {
                      closeModal();
                      utils.channels.get.invalidate();
                    }}
                  />
                ),
                props: { title: "Create channel" },
              });
            }}
          >
            Create channel
          </Button>
        </>
      ) : undefined}
    </VerticalStack>
  );
};

const ChannelListWrapper = () => {
  return (
    <Paper
      elevation={1}
      className={clsx(
        `${defaultPadding} h-full min-h-[300px] flex flex-1 flex-col max-w-2xs max-md:hidden rounded-none ring ring-[var(--mui-palette-divider)]`
      )}
    >
      <LoadingBoundary isOuter addClassName="min-h-0">
        <ChannelList />
      </LoadingBoundary>
    </Paper>
  );
};

export default ChannelListWrapper;
