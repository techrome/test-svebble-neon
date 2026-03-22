import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Virtuoso } from "react-virtuoso";
import {
  CircularProgress,
  ListItemButton,
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

import { trpc, type RouterOutput } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import Button from "@/components/Button/Button";
import clsx from "clsx";
import {
  defaultPaddingXs,
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import UserAvatar, { sizesMap } from "@/components/Avatar/UserAvatar";
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
  onOptimisticRetry: React.MouseEventHandler<HTMLButtonElement>;
  onOptimisticDelete: React.MouseEventHandler<HTMLButtonElement>;
  onReportClick: React.MouseEventHandler<HTMLElement>;
};

type FormValues = z.infer<typeof messageUpdateSchemaForm>;

const Message = ({
  message,
  shouldHighlight,
  onHighlightConsumed,
  onUpdateSuccess,
  onDeleteSuccess,
  onOptimisticRetry,
  onOptimisticDelete,
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
      <IconButton size="small" onClick={menuPopover.openPopover}>
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
      <HorizontalStack
        ref={ref}
        addClassName={clsx(
          "px-3 py-1",
          "relative justify-between group hover:bg-[var(--mui-palette-action-focus)]"
        )}
        wrap={false}
      >
        <VerticalStack>
          <HorizontalStack wrap={false}>
            {user.data?.user && !message.isCompact ? (
              <UserAvatar
                user={
                  isOwnMessage
                    ? user.data.user
                    : {
                        username: user.data.user.username,
                        id: user.data.user.id,
                      }
                }
              />
            ) : (
              <div className="min-w-8" />
            )}
            <VerticalStack spacing="none" fullWidth={false}>
              {!message.isCompact && (
                <HorizontalStack addClassName="items-center">
                  <Typography>
                    <strong>{user.data?.user?.name}</strong>
                  </Typography>
                  <Tooltip
                    title={dayjs(message.created_at).format(
                      dateTimeFormatFullDisplay
                    )}
                  >
                    <Typography variant="subtitle2" color="textSecondary">
                      {dayjs(message.created_at).format(timeFormat)}
                    </Typography>
                  </Tooltip>
                </HorizontalStack>
              )}
              <Typography
                color={message.isOptimistic ? "textDisabled" : "textPrimary"}
              >
                {message.content}
              </Typography>
            </VerticalStack>
          </HorizontalStack>
          {message.isOptimistic ? null : isDesktop ? (
            <Paper
              elevation={4}
              className={clsx(
                "absolute -top-6 right-2 flex",
                !menuPopover.isOpen && "opacity-0 pointer-events-none",
                "group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
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
        </VerticalStack>
      </HorizontalStack>
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

  // return (
  //   <div ref={ref} className={clsx("p-2 flex flex-wrap gap-3")}>
  //     {isEdit ? (
  //       <>
  //         <input
  //           className="border block p-3 w-52"
  //           value={editInfo.content}
  //           onChange={(e) => {
  //             setEditInfo((prev) => ({
  //               ...prev,
  //               content: e.target.value,
  //             }));
  //           }}
  //         />
  //         <Button
  //           variant="outlined"
  //           onClick={() => {
  //             messagesUpdateMutation.mutate({
  //               content: editInfo.content,
  //               id: editInfo.id,
  //               channelId: editInfo.channel_id,
  //             });
  //           }}
  //           disabled={messagesUpdateMutation.isPending}
  //         >
  //           Save
  //         </Button>
  //       </>
  //     ) : (
  //       <>
  //         <h6 className="word-break-word text-red-500">
  //           {message.deleted_at
  //             ? "(Deleted)"
  //             : message.isOptimistic
  //               ? "PENDING"
  //               : ""}
  //         </h6>
  //         <h6 className="word-break-word">{message.id}</h6>
  //         <h5 className="word-break-word">{message.content}</h5>
  //         {message.isFailed ? (
  //           <>
  //             <h6 className="word-break-word text-red-500">Failed. Retry?</h6>
  //             <Button
  //               variant="outlined"
  //               onClick={() => {
  //                 //onOptimisticRetry?.(message);
  //               }}
  //             >
  //               Retry optimistic
  //             </Button>
  //             <Button
  //               variant="outlined"
  //               onClick={() => {
  //                 //  onOptimisticDelete?.(message);
  //               }}
  //             >
  //               Delete optimistic
  //             </Button>
  //           </>
  //         ) : null}
  //         <Button
  //           variant="outlined"
  //           onClick={() => {
  //             setEditInfo(message);
  //             setIsEdit(true);
  //           }}
  //         >
  //           Edit
  //         </Button>
  //       </>
  //     )}

  //     {isEdit ? (
  //       <Button
  //         variant="outlined"
  //         onClick={() => {
  //           setEditInfo(message);
  //           setIsEdit(false);
  //         }}
  //       >
  //         Cancel
  //       </Button>
  //     ) : (
  //       <Button
  //         variant="outlined"
  //         onClick={() => {
  //           messagesDeleteMutation.mutate({ id: message.id });
  //         }}
  //         disabled={messagesDeleteMutation.isPending}
  //       >
  //         Delete
  //       </Button>
  //     )}
  //   </div>
  // );
};

export default Message;
