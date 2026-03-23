import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CircularProgress,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Paper,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddReactionIcon from "@mui/icons-material/AddReaction";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import FlagIcon from "@mui/icons-material/Flag";
import ReplyIcon from "@mui/icons-material/Reply";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import LinkIcon from "@mui/icons-material/Link";
import ReplayIcon from "@mui/icons-material/Replay";

import { trpc, type RouterOutput } from "@/trpc";
import Button from "@/components/Button/Button";
import clsx from "clsx";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import UserAvatar from "@/components/Avatar/UserAvatar";
import { useUser } from "@/trpc/hooks/useUser";
import { useLocalPopover } from "@/utils/hooks/useOverlay";
import IconButton from "@/components/Button/IconButton";
import dayjs from "@/utils/dayjs";
import {
  dateTimeFormat,
  dateTimeFormatFullDisplay,
  timeFormat,
} from "@/utils/dateFormats";
import Tooltip from "@/components/Tooltip/Tooltip";
import Popconfirm from "@/components/Popover/Popconfirm";
import useIsDesktop from "@/utils/hooks/useIsDesktop";
import { Divider } from "@/components/Layout/Dividers";
import {
  makeMessageUpdateSchemaForm,
  messageUpdateSchemaForm,
} from "@/utils/validators/shared/messages";
import { z } from "@/utils/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/Fields/Input";
import { submitTextareaOnEnter } from "@/utils/formSubmission";
import { useAppSnackbar } from "@/utils/snackbar";
import { copyToClipboard } from "@/utils/stringUtils";

const hoverChildHiddenClass = "opacity-0 pointer-events-none";
const hoverChildHoveredClass =
  "group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto";

type MessageUpdateMutationOptions = NonNullable<
  Parameters<typeof trpc.messages.update.useMutation>[0]
>;
type MessageDeleteMutationOptions = NonNullable<
  Parameters<typeof trpc.messages.delete.useMutation>[0]
>;

export type RenderedMessage =
  RouterOutput["messages"]["get"]["items"][number] & {
    isOptimistic?: true;
    isFailed?: true;
    isCompact?: true;
  };

type Props = {
  message: RenderedMessage;
  shouldHighlight?: boolean;
  onHighlightConsumed?: () => void;
  onUpdateSuccess: MessageUpdateMutationOptions["onSuccess"];
  onDeleteSuccess: MessageDeleteMutationOptions["onSuccess"];
  onOptimisticFailedRetry: React.MouseEventHandler<HTMLButtonElement>;
  onOptimisticFailedDelete: React.MouseEventHandler<HTMLButtonElement>;
  onReportClick: React.MouseEventHandler<HTMLElement>;
};

type FormValues = z.infer<typeof messageUpdateSchemaForm>;

const Message = ({
  message,
  shouldHighlight,
  onHighlightConsumed,
  onUpdateSuccess,
  onDeleteSuccess,
  onOptimisticFailedRetry,
  onOptimisticFailedDelete,
  onReportClick,
}: Props) => {
  const user = useUser();
  const menuPopover = useLocalPopover();
  const isDesktop = useIsDesktop();
  const ref = useRef<HTMLDivElement | null>(null);
  const { addAppSnackbar } = useAppSnackbar();

  const schema = useMemo(
    () => makeMessageUpdateSchemaForm(user.data?.user?.emailVerified),
    [user.data?.user?.emailVerified]
  );
  const form = useForm<FormValues>({
    defaultValues: { content: message.content, id: message.id },
    resolver: zodResolver(schema),
  });
  const isFormDirty = form.formState.isDirty;

  const [isEdit, setIsEdit] = useState(false);

  const messagesUpdateMutation = trpc.messages.update.useMutation({
    onSuccess: (...args) => {
      exitEditMode();
      onUpdateSuccess?.(...args);
    },
  });
  const messagesDeleteMutation = trpc.messages.delete.useMutation({
    onSuccess: onDeleteSuccess,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (shouldHighlight && el) {
      el.classList.remove("hash-flash");
      void el.offsetWidth;
      el.classList.add("hash-flash");

      onHighlightConsumed?.();
    }

    // eslint-disable-next-line
  }, [shouldHighlight]);

  useEffect(() => {
    if (!isEdit) {
      form.reset({ content: message.content, id: message.id });
    }
  }, [message, isEdit, form]);

  const MoreButton = (
    <Tooltip title="More">
      <IconButton
        size="small"
        className="self-start"
        onClick={menuPopover.openPopover}
      >
        <MoreVertIcon />
      </IconButton>
    </Tooltip>
  );

  const isOwnMessage = message.user_id === user.data?.user?.id;

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    if (!isFormDirty) {
      addAppSnackbar({
        message: "No changes to save",
      });
      return;
    }
    messagesUpdateMutation.mutate(values);
  };

  const exitEditMode = () => {
    setIsEdit(false);
    form.reset();
  };

  const { createdAtShort, createdAtFull, updatedAtFull } = useMemo(() => {
    const createdAt = dayjs(message.created_at);
    const isToday = createdAt.isSame(dayjs(), "day");
    const createdAtShort =
      message.isCompact || isToday
        ? createdAt.format(timeFormat)
        : createdAt.format(dateTimeFormat);
    const createdAtFull = createdAt.format(dateTimeFormatFullDisplay);
    const hasEdited =
      message.created_at.getTime() !== message.updated_at.getTime();
    const updatedAtFull = hasEdited
      ? dayjs(message.updated_at).format(dateTimeFormatFullDisplay)
      : null;
    return {
      createdAtShort,
      createdAtFull,
      updatedAtFull,
    };
  }, [message.created_at, message.isCompact, message.updated_at]);
  const shouldDisplayAvatar = Boolean(user.data?.user && !message.isCompact);

  if (isEdit) {
    return (
      <div>
        <form
          className="p-2 bg-[var(--mui-palette-action-selected)]"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <VerticalStack>
            <Input
              control={form.control}
              name="content"
              label="Message"
              fullWidth
              variant="standard"
              hideError
              multiline
              maxRows={10}
              autoFocus
              onFocus={(e) => {
                const el = e.currentTarget;
                const end = el.value.length;
                el.setSelectionRange(end, end);
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <HorizontalStack wrap={false} addClassName="self-start">
                      <Tooltip title="Add emoji">
                        <IconButton type="button" onClick={() => {}}>
                          <EmojiEmotionsIcon />
                        </IconButton>
                      </Tooltip>
                    </HorizontalStack>
                  ),
                  onKeyDown: submitTextareaOnEnter,
                },
              }}
            />
          </VerticalStack>
          <HorizontalStack>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              isLoading={messagesUpdateMutation.isPending}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="contained"
              color="inherit"
              onClick={exitEditMode}
              disabled={messagesUpdateMutation.isPending}
            >
              Cancel
            </Button>
          </HorizontalStack>
        </form>
      </div>
    );
  }

  return (
    <div className={message.isCompact ? "" : "pt-2"}>
      <VerticalStack
        spacing="none"
        addClassName="px-1 relative group hover:bg-[var(--mui-palette-action-focus)]"
      >
        <HorizontalStack
          ref={ref}
          addClassName="px-1 py-1 justify-between items-center"
          fullWidth
          wrap={false}
        >
          <HorizontalStack wrap={false} spacing="xs">
            <div
              className={clsx(
                "min-w-12 max-w-12 flex",
                shouldDisplayAvatar
                  ? `justify-center`
                  : `justify-end ${hoverChildHiddenClass} ${hoverChildHoveredClass}`
              )}
            >
              {shouldDisplayAvatar && user.data?.user ? (
                <div className="pt-1">
                  <UserAvatar
                    user={
                      isOwnMessage
                        ? user.data.user
                        : {
                            username: user.data.user.username,
                            id: user.data.user.id,
                          }
                    }
                    size="md"
                  />
                </div>
              ) : !message.isOptimistic ? (
                <Tooltip title={createdAtFull}>
                  <Typography
                    variant="caption"
                    className="mt-1"
                    color="textSecondary"
                  >
                    {createdAtShort}
                  </Typography>
                </Tooltip>
              ) : null}
            </div>
            <VerticalStack spacing="none" fullWidth={false}>
              {!message.isCompact && (
                <HorizontalStack addClassName="items-center">
                  <Typography>
                    <strong>{user.data?.user?.name}</strong>
                  </Typography>
                  <Tooltip title={createdAtFull}>
                    <Typography variant="caption" color="textSecondary">
                      {createdAtShort}
                    </Typography>
                  </Tooltip>
                </HorizontalStack>
              )}
              <Typography
                color={message.isOptimistic ? "textDisabled" : "textPrimary"}
              >
                {message.content}
                {updatedAtFull ? (
                  <Tooltip title={updatedAtFull}>
                    <Typography
                      component="span"
                      color="textDisabled"
                      variant="caption"
                    >
                      {" "}
                      (edited)
                    </Typography>
                  </Tooltip>
                ) : null}
              </Typography>
            </VerticalStack>
          </HorizontalStack>
          {message.isOptimistic ? null : isDesktop ? (
            <Paper
              elevation={4}
              className={clsx(
                "absolute -top-6 right-2 flex",
                !menuPopover.isOpen && hoverChildHiddenClass,
                hoverChildHoveredClass
              )}
            >
              <HorizontalStack addClassName="p-1" spacing="none">
                <Tooltip title="Add Reaction">
                  <IconButton size="small">
                    <AddReactionIcon />
                  </IconButton>
                </Tooltip>
                {isOwnMessage && (
                  <Tooltip title="Edit Message">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setIsEdit(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Reply">
                  <IconButton size="small">
                    <ReplyIcon />
                  </IconButton>
                </Tooltip>
                {MoreButton}
              </HorizontalStack>
            </Paper>
          ) : (
            MoreButton
          )}
        </HorizontalStack>
        {message.isOptimistic && message.isFailed && (
          <VerticalStack spacing="xs" addClassName="pl-[3.75rem] pr-2 pb-2">
            <Typography color="warning" variant="body2">
              Failed to send message. Retry?
            </Typography>
            <HorizontalStack>
              <Button
                variant="contained"
                color="primary"
                startIcon={<ReplayIcon />}
                onClick={onOptimisticFailedRetry}
                className="w-fit"
              >
                Retry
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={onOptimisticFailedDelete}
                className="w-fit"
              >
                Delete
              </Button>
            </HorizontalStack>
          </VerticalStack>
        )}
      </VerticalStack>
      <menuPopover.ReadyComponent>
        <Paper>
          <MenuList>
            <MenuItem>
              <ListItemIcon>
                <AddReactionIcon />
              </ListItemIcon>
              <ListItemText>Add Reaction</ListItemText>
            </MenuItem>
            <MenuItem>
              <ListItemIcon>
                <ReplyIcon />
              </ListItemIcon>
              <ListItemText>Reply</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={async () => {
                const copySuccess = await copyToClipboard(
                  window.location.origin +
                    window.location.pathname +
                    `?messageId=${String(message.id)}`
                );
                addAppSnackbar({
                  message: copySuccess
                    ? "Link copied"
                    : "Failed to copy the link",
                  variant: copySuccess ? "success" : "error",
                });
                menuPopover.closePopover();
              }}
            >
              <ListItemIcon>
                <LinkIcon />
              </ListItemIcon>
              <ListItemText>Copy Message Link</ListItemText>
            </MenuItem>
            <Divider />
            {isOwnMessage ? (
              [
                <MenuItem
                  key={1}
                  onClick={() => {
                    setIsEdit(true);
                    menuPopover.closePopover();
                  }}
                >
                  <ListItemIcon>
                    <EditIcon />
                  </ListItemIcon>
                  <ListItemText>Edit Message</ListItemText>
                </MenuItem>,
                <Popconfirm
                  key={2}
                  title="Are you sure you want to delete this message?"
                  onConfirm={() => {
                    messagesDeleteMutation.mutate({ id: message.id });
                  }}
                >
                  <MenuItem
                    sx={(theme) => ({ color: theme.palette.error.main })}
                    disabled={messagesDeleteMutation.isPending}
                  >
                    <ListItemIcon>
                      {messagesDeleteMutation.isPending ? (
                        <CircularProgress size={24} color="error" />
                      ) : (
                        <DeleteIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText>Delete Message</ListItemText>
                  </MenuItem>
                </Popconfirm>,
              ]
            ) : (
              <MenuItem
                sx={(theme) => ({ color: theme.palette.warning.main })}
                onClick={(e) => {
                  onReportClick(e);
                  menuPopover.closePopover();
                }}
              >
                <ListItemIcon>
                  <FlagIcon color="warning" />
                </ListItemIcon>
                <ListItemText>Report Message</ListItemText>
              </MenuItem>
            )}
          </MenuList>
        </Paper>
      </menuPopover.ReadyComponent>
    </div>
  );
};

export default Message;
