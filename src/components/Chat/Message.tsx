import React, {
  useCallback,
  useEffect,
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
import LinkIcon from "@mui/icons-material/Link";
import ReplayIcon from "@mui/icons-material/Replay";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";

import { trpc, type RouterOutput } from "@/trpc";
import Button from "@/components/Button/Button";
import clsx from "clsx";
import {
  defaultPadding,
  HorizontalStack,
  VerticalStack,
} from "@/components/Layout/Containers";
import UserAvatar from "@/components/Avatar/UserAvatar";
import { useUser } from "@/trpc/hooks/useUser";
import { useLocalPopover } from "@/utils/hooks/useOverlay";
import IconButton from "@/components/Button/IconButton";
import dayjs from "@/utils/dayjs";
import {
  dateFormatDisplay,
  dateTimeFormat,
  dateTimeFormatFullDisplay,
  timeFormat,
} from "@/utils/dateFormats";
import Tooltip from "@/components/Tooltip/Tooltip";
import Popconfirm from "@/components/Popover/Popconfirm";
import useIsDesktop from "@/utils/hooks/useIsDesktop";
import { Divider } from "@/components/Layout/Dividers";
import { z } from "@/utils/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppSnackbar } from "@/utils/snackbar";
import { copyToClipboard } from "@/utils/stringUtils";
import MessageEditor from "@/components/Chat/MessageEditor";
import { makeMessageUpdateSchemaForm } from "@/utils/validators/client/messages";
import { useLatest } from "@/utils/hooks/useLatest";
import ReplyCountButton from "@/components/Chat/ReplyCountButton";
import Link from "@/components/Link/Link";
import ButtonBase from "@/components/Button/ButtonBase";

const closestWithin = <T extends HTMLElement>(
  start: EventTarget | null,
  selector: string,
  boundary: HTMLElement
): T | null => {
  let node = start instanceof HTMLElement ? start : null;

  while (node) {
    if (node.matches(selector)) return node as T;
    if (node === boundary) break;
    node = node.parentElement;
  }

  return null;
};

const hoverChildHiddenClass = "opacity-0 pointer-events-none";
const hoverChildHoveredClass =
  "group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto";

type MessageUpdateMutationOptions = NonNullable<
  Parameters<typeof trpc.messages.update.useMutation>[0]
>;
type MessageDeleteMutationOptions = NonNullable<
  Parameters<typeof trpc.messages.delete.useMutation>[0]
>;

export type Message = RouterOutput["messages"]["get"]["items"][number];

export type RenderedMessage = Message & {
  isOptimistic?: true;
  isFailed?: true;
  isCompact?: true;
  isFirstMessageOfTheDay?: true;
};

type Props = {
  message: RenderedMessage;
  totalItems: number;
  shouldHighlight?: boolean;
  isIdleRef?: React.RefObject<boolean>;
  isIdleTrigger?: number;
  onHighlightConsumed?: () => void;
  onUpdateSuccess: MessageUpdateMutationOptions["onSuccess"];
  onDeleteSuccess: MessageDeleteMutationOptions["onSuccess"];
  onOptimisticFailedRetry: React.MouseEventHandler<HTMLButtonElement>;
  onOptimisticFailedDelete: React.MouseEventHandler<HTMLButtonElement>;
  onReportClick: React.MouseEventHandler<HTMLElement>;
  onReplyClick: React.MouseEventHandler<HTMLElement>;
};

type FormValues = z.infer<ReturnType<typeof makeMessageUpdateSchemaForm>>;

const Message = ({
  message,
  totalItems,
  shouldHighlight,
  isIdleTrigger,
  isIdleRef,
  onHighlightConsumed,
  onUpdateSuccess,
  onDeleteSuccess,
  onOptimisticFailedRetry,
  onOptimisticFailedDelete,
  onReportClick,
  onReplyClick,
}: Props) => {
  const user = useUser();
  const menuPopover = useLocalPopover();
  const externalLinkConfirmationPopover = useLocalPopover({ useTarget: true });
  const staticDependencies = useLatest({ externalLinkConfirmationPopover });
  const isDesktop = useIsDesktop();
  const ref = useRef<HTMLDivElement | null>(null);
  const editFormRef = useRef<HTMLFormElement | null>(null);
  const utils = trpc.useUtils();
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
  const [pendingExternalLink, setPendingExternalLink] = useState<string>("");

  const messagesUpdateMutation = trpc.messages.update.useMutation({
    onSuccess: (...args) => {
      exitEditMode();
      onUpdateSuccess?.(...args);
    },
  });
  const messagesDeleteMutation = trpc.messages.delete.useMutation({
    onSuccess: onDeleteSuccess,
  });

  useEffect(() => {
    if (!shouldHighlight || !isIdleRef?.current || !ref.current) return;
    const el = ref.current;

    el.classList.remove("hash-flash-inner");
    void el.offsetWidth;
    el.classList.add("hash-flash-inner");
    onHighlightConsumed?.();

    // eslint-disable-next-line
  }, [shouldHighlight, isIdleTrigger]);

  useEffect(() => {
    if (!isEdit) {
      form.reset({ content: message.content, id: message.id });
    }
  }, [message, isEdit, form]);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        editFormRef.current?.scrollIntoView({
          behavior: "auto",
          block: "nearest",
          inline: "nearest",
        });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isEdit]);

  useEffect(() => {
    utils.messages.getReplies.invalidate({ messageId: String(message.id) });
    // eslint-disable-next-line
  }, [message.reply_count]);

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

  const {
    createdAtShort,
    createdAtFull,
    updatedAtFull,
    parentMessageUpdatedAtFull,
    dayDisplay,
  } = useMemo(() => {
    const createdAt = dayjs(message.created_at);
    const isToday = createdAt.isSame(dayjs(), "day");
    const createdAtShort =
      message.isCompact || isToday
        ? createdAt.format(timeFormat)
        : createdAt.format(dateTimeFormat);
    const createdAtFull = createdAt.format(dateTimeFormatFullDisplay);
    const hasEdited =
      message.created_at.getTime() !== message.edited_at.getTime();

    const updatedAtFull = hasEdited
      ? dayjs(message.edited_at).format(dateTimeFormatFullDisplay)
      : null;
    let parentMessageUpdatedAtFull: string | null = null;
    const parentMessage = message.parentMessage;
    if (
      parentMessage &&
      parentMessage.created_at.getTime() !== parentMessage.edited_at.getTime()
    ) {
      parentMessageUpdatedAtFull = dayjs(parentMessage.edited_at).format(
        dateTimeFormatFullDisplay
      );
    }

    const dayDisplay = message.isFirstMessageOfTheDay
      ? createdAt.format(dateFormatDisplay)
      : null;
    return {
      createdAtShort,
      createdAtFull,
      updatedAtFull,
      parentMessageUpdatedAtFull,
      dayDisplay,
    };
    // eslint-disable-next-line
  }, [
    message.created_at,
    message.isCompact,
    message.edited_at,
    message.isFirstMessageOfTheDay,
    message.parentMessage,
    totalItems,
  ]);

  const shouldDisplayAvatar = Boolean(!message.isCompact);

  const onHTMLContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const boundary = e.currentTarget;
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const spoiler = closestWithin<HTMLElement>(target, `[sp="1"]`, boundary);

      if (spoiler) {
        const isOpen = spoiler.getAttribute("data-spoiler-open") === "1";
        if (!isOpen) {
          e.preventDefault();
          spoiler.setAttribute("data-spoiler-open", "1");
          return;
        }
      }
      const link = closestWithin<HTMLAnchorElement>(
        target,
        `a[href]`,
        boundary
      );

      if (link) {
        const { externalLinkConfirmationPopover } = staticDependencies.current;
        e.preventDefault();

        setPendingExternalLink(link.href);
        externalLinkConfirmationPopover.openPopover(e);
        return;
      }
    },
    [staticDependencies]
  );

  const messageHTMLContent = useMemo(() => {
    return (
      <div
        className="message-html"
        dangerouslySetInnerHTML={{
          __html: message.content,
        }}
        onClick={onHTMLContentClick}
      />
    );
  }, [message.content, onHTMLContentClick]);

  if (isEdit) {
    return (
      <div>
        <form
          className="p-2 bg-mui-action-selected"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          ref={editFormRef}
        >
          <VerticalStack>
            <MessageEditor
              control={form.control}
              name="content"
              placeholder={`Message`}
              autoFocus
              hideError
              isEdit
            />
            <HorizontalStack>
              <Button
                type="button"
                variant="contained"
                color="inherit"
                onClick={exitEditMode}
                disabled={messagesUpdateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                isLoading={messagesUpdateMutation.isPending}
              >
                Save
              </Button>
            </HorizontalStack>
          </VerticalStack>
        </form>
      </div>
    );
  }

  return (
    <div className={message.isCompact || dayDisplay ? "" : "pt-2"}>
      {Boolean(dayDisplay) && (
        <Divider className="py-2 px-3">
          <Typography variant="caption" color="textDisabled">
            {dayDisplay}
          </Typography>
        </Divider>
      )}
      <VerticalStack
        spacing="none"
        addClassName={`relative group hover:bg-mui-action-focus`}
        ref={ref}
      >
        {!!message.reply_to_message_id &&
          (!message.isOptimistic && !message.parentMessage ? (
            <HorizontalStack
              addClassName="pl-6 pr-1 items-center text-mui-text-secondary"
              fullWidth
              spacing="xs"
            >
              <ReplyIcon fontSize="small" className="-scale-x-100" />
              <Typography>Message was deleted</Typography>
            </HorizontalStack>
          ) : (
            <Link
              href={`?messageId=${message.reply_to_message_id}`}
              className="no-underline"
            >
              <ButtonBase
                focusRipple
                className="w-full hover:cursor-pointer hover:bg-mui-action-selected text-mui-text-secondary"
              >
                <HorizontalStack
                  addClassName="pl-6 pr-1 items-center"
                  fullWidth
                  spacing="xs"
                >
                  <ReplyIcon fontSize="small" className="-scale-x-100" />
                  <Typography>
                    <Typography component={"span"}>
                      <strong>
                        {message.parentMessage
                          ? message.parentMessage.author.name
                          : "Loading..."}
                      </strong>
                    </Typography>
                  </Typography>
                  <div className="flex items-center gap-1 overflow-hidden">
                    <Typography className="text-ellipsis whitespace-nowrap overflow-hidden">
                      {message.parentMessage?.contentPreview}
                    </Typography>
                    {parentMessageUpdatedAtFull ? (
                      <Tooltip title={parentMessageUpdatedAtFull}>
                        <Typography
                          className="whitespace-nowrap"
                          component="span"
                          color="textDisabled"
                          variant="caption"
                        >
                          (edited)
                        </Typography>
                      </Tooltip>
                    ) : null}
                  </div>
                </HorizontalStack>
              </ButtonBase>
            </Link>
          ))}
        <div className={`px-1`}>
          <HorizontalStack
            addClassName="px-1 py-1 justify-between items-center"
            fullWidth
            wrap={false}
          >
            <HorizontalStack wrap={false} spacing="xs" addClassName="flex-1">
              <div
                className={clsx(
                  "min-w-12 max-w-12 flex",
                  !shouldDisplayAvatar && isDesktop
                    ? `justify-center ${hoverChildHiddenClass} ${hoverChildHoveredClass}`
                    : `justify-center`
                )}
              >
                {shouldDisplayAvatar ? (
                  <div className="pt-1">
                    <UserAvatar user={message.author} size="md" />
                  </div>
                ) : !message.isOptimistic ? (
                  <Tooltip title={createdAtFull}>
                    <Typography
                      variant="caption"
                      className="text-xs/6"
                      color="textDisabled"
                    >
                      {createdAtShort}
                    </Typography>
                  </Tooltip>
                ) : null}
              </div>
              <VerticalStack
                spacing="none"
                fullWidth={false}
                addClassName="flex-1"
              >
                {!message.isCompact && (
                  <HorizontalStack addClassName="items-center" spacing="xs">
                    <Typography>
                      <strong>{message.author.name}</strong>
                    </Typography>
                    <Tooltip title={createdAtFull}>
                      <Typography variant="caption" color="textDisabled">
                        {createdAtShort}
                      </Typography>
                    </Tooltip>
                  </HorizontalStack>
                )}
                <Typography
                  color={message.isOptimistic ? "textDisabled" : "textPrimary"}
                  component={"div"}
                  className="message-content"
                >
                  {messageHTMLContent}
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
                  <Tooltip title="Add reaction">
                    <IconButton size="small">
                      <AddReactionIcon />
                    </IconButton>
                  </Tooltip>
                  {isOwnMessage && (
                    <Tooltip title="Edit message">
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
                    <IconButton size="small" onClick={onReplyClick}>
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
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={onOptimisticFailedDelete}
                  className="w-fit"
                >
                  Delete
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<ReplayIcon />}
                  onClick={onOptimisticFailedRetry}
                  className="w-fit"
                >
                  Retry
                </Button>
              </HorizontalStack>
            </VerticalStack>
          )}
        </div>
        {!!message.reply_count && <ReplyCountButton message={message} />}
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
            <MenuItem onClick={onReplyClick}>
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
                    sx={(theme) => ({ color: theme.vars?.palette.error.main })}
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
                sx={(theme) => ({ color: theme.vars?.palette.warning.main })}
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
      <externalLinkConfirmationPopover.ReadyComponent>
        <VerticalStack addClassName={`${defaultPadding} min-w-xs max-w-sm`}>
          <Typography>
            You will be navigated to the following address:
          </Typography>
          <Typography
            variant="h6"
            component={"p"}
            color="primary"
            className="text-center max-h-[300px] overflow-y-auto"
          >
            {pendingExternalLink}
          </Typography>
          <HorizontalStack addClassName="justify-between">
            <Button
              variant="contained"
              color="inherit"
              onClick={externalLinkConfirmationPopover.closePopover}
            >
              Cancel
            </Button>
            <a
              href={pendingExternalLink}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              <Button
                variant="contained"
                color="primary"
                endIcon={<ArrowOutwardIcon />}
              >
                Proceed
              </Button>
            </a>
          </HorizontalStack>
        </VerticalStack>
      </externalLinkConfirmationPopover.ReadyComponent>
    </div>
  );
};

export default Message;
