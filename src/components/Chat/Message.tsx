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
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";

import { trpc, type RouterOutput } from "@/trpc";
import Button from "@/components/Button/Button";
import clsx from "clsx";
import {
  defaultPadding,
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import UserAvatar from "@/components/Avatar/UserAvatar";
import { useUser } from "@/trpc/hooks/useUser";
import { useGlobalModal, useLocalPopover } from "@/utils/hooks/useOverlay";
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
import ParentMessagePreview from "@/components/Chat/ParentMessagePreview";
import { StrictOmit } from "@/utils/types";
import {
  MessageAttachmentDisplayList,
  type MessageAttachmentDeleteMutationOptions,
} from "@/components/Chat/MessageAttachments";
import ButtonBase from "@/components/Button/ButtonBase";
import MessageReactionPicker from "@/components/Chat/MessageReactionPicker";
import MessageReactionList from "@/components/Chat/MessageReactionList";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import { useAppDispatch } from "@/redux/hooks";
import { deleteAllPendingMessageReactions } from "@/redux/slices/messageReactionsUI";
import { hasPermissions } from "@/utils/hasPermissions";
import { P } from "@/utils/permissions";
import UserProfile from "@/components/Chat/UserProfile";

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

const usernameMaxSideCharacters = 4;
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

export type ToggleMessageReaction = ReturnType<
  typeof trpc.messages.toggleReaction.useMutation
>["mutate"];

type RenderedMessageFlags = {
  isCompact?: true;
  isFirstMessageOfTheDay?: true;
  isFailed?: true;
};

export type ServerRenderedMessage = Message &
  RenderedMessageFlags & {
    isOptimistic?: false;
  };

type OptimisticRenderedMessage = StrictOmit<Message, "attachments"> &
  RenderedMessageFlags & {
    isOptimistic: true;
    attachments: string[];
  };

export type RenderedMessage = ServerRenderedMessage | OptimisticRenderedMessage;

type Props = {
  message: RenderedMessage;
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
  onAttachmentDeleteSuccess: MessageAttachmentDeleteMutationOptions["onSuccess"];
  onReactionClick: ToggleMessageReaction;
};

type FormValues = z.input<ReturnType<typeof makeMessageUpdateSchemaForm>>;

const Message = ({
  message,
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
  onAttachmentDeleteSuccess,
  onReactionClick,
}: Props) => {
  const user = useUser();
  const dispatch = useAppDispatch();
  const menuPopover = useLocalPopover();
  const userPopover = useLocalPopover();
  const reactionsPopover = useLocalPopover();
  const externalLinkConfirmationPopover = useLocalPopover({ useTarget: true });
  const globalModal = useGlobalModal();
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
    utils.messages.getReplies.invalidate({ messageId: message.id });
    // eslint-disable-next-line
  }, [message.reply_count]);

  useEffect(() => {
    return () => {
      dispatch(deleteAllPendingMessageReactions({ messageId: message.id }));
    };
  }, [dispatch, message.id]);

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

  const handleReplyClick: typeof onReplyClick = (e) => {
    menuPopover.closePopover();
    onReplyClick(e);
  };

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
  };

  const { canToggleReaction, canCreateMessage, canReportMessage } =
    useMemo(() => {
      const userData = user.data?.user;
      return {
        canToggleReaction: hasPermissions(userData, [
          P.messageReactions.toggle,
        ]),
        canCreateMessage: hasPermissions(userData, [P.messages.create]),
        canReportMessage: hasPermissions(userData, [P.messages.report]),
      };
    }, [user.data?.user]);

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
  }, [
    message.created_at,
    message.isCompact,
    message.edited_at,
    message.isFirstMessageOfTheDay,
    message.parentMessage,
  ]);

  const truncatedUsername = useMemo(() => {
    const username = message.author.username;
    if (!username) return username;

    const shouldTruncate = username.length > usernameMaxSideCharacters * 2 + 3; // 3 dots
    if (!shouldTruncate) return username;

    const start = username.slice(0, usernameMaxSideCharacters);
    const end = username.slice(-usernameMaxSideCharacters);
    return `${start}...${end}`;
  }, [message.author.username]);

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
        {!!message.reply_to_message_id && (
          <ParentMessagePreview
            message={message}
            parentMessageUpdatedAtFull={parentMessageUpdatedAtFull}
          />
        )}
        <div className={`px-1`}>
          <HorizontalStack
            addClassName="px-1 py-1 justify-between items-center"
            fullWidth
            wrap={false}
          >
            <HorizontalStack
              minWidth
              wrap={false}
              spacing="xs"
              addClassName="flex-1"
            >
              <div
                className={clsx(
                  "min-w-12 max-w-12 flex",
                  !shouldDisplayAvatar && isDesktop
                    ? `justify-center ${hoverChildHiddenClass} ${hoverChildHoveredClass}`
                    : `justify-center`
                )}
              >
                {shouldDisplayAvatar ? (
                  <ButtonBase
                    className="p-1 transition hover:bg-mui-action-focus cursor-pointer rounded-md h-fit"
                    onClick={userPopover.openPopover}
                  >
                    <UserAvatar user={message.author} size="md" />
                  </ButtonBase>
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
                minWidth
                addClassName="flex-1"
              >
                {!message.isCompact && (
                  <HorizontalStack
                    addClassName="items-center pb-1"
                    spacing="xs"
                  >
                    <Button
                      variant="text"
                      color="inherit"
                      className="-ml-1 p-0 hover:bg-mui-action-focus"
                      innerClassName="py-0 px-1 flex gap-1 items-center normal-case min-w-0"
                      onClick={userPopover.openPopover}
                    >
                      <Typography className="overflow-hidden whitespace-nowrap text-ellipsis">
                        <strong>{message.author.name}</strong>
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        className="whitespace-nowrap"
                      >
                        {truncatedUsername}
                      </Typography>
                    </Button>
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
                <MessageAttachmentDisplayList
                  message={message}
                  onAttachmentDeleteSuccess={onAttachmentDeleteSuccess}
                />
                {!message.isOptimistic && (
                  <MessageReactionList
                    message={message}
                    toggleReaction={onReactionClick}
                  />
                )}
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
                  {canToggleReaction && (
                    <Tooltip title="Add reaction">
                      <IconButton
                        size="small"
                        onClick={reactionsPopover.openPopover}
                      >
                        <AddReactionIcon />
                      </IconButton>
                    </Tooltip>
                  )}
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
                  {canCreateMessage && (
                    <Tooltip title="Reply">
                      <IconButton size="small" onClick={handleReplyClick}>
                        <ReplyIcon />
                      </IconButton>
                    </Tooltip>
                  )}
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
                  startIcon={<RefreshIcon />}
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
            {canToggleReaction && (
              <MenuItem onClick={reactionsPopover.openPopover}>
                <ListItemIcon>
                  <AddReactionIcon />
                </ListItemIcon>
                <ListItemText>Add Reaction</ListItemText>
              </MenuItem>
            )}
            {canCreateMessage && (
              <MenuItem onClick={handleReplyClick}>
                <ListItemIcon>
                  <ReplyIcon />
                </ListItemIcon>
                <ListItemText>Reply</ListItemText>
              </MenuItem>
            )}
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
            {(isOwnMessage || canReportMessage) && <Divider />}
            {isOwnMessage
              ? [
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
                      sx={(theme) => ({
                        color: theme.vars?.palette.error.main,
                      })}
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
              : canReportMessage && (
                  <MenuItem
                    sx={(theme) => ({
                      color: theme.vars?.palette.warning.main,
                    })}
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
      <userPopover.ReadyComponent placement="right">
        <Section fullWidth={false} addClassName="min-w-xs max-w-sm">
          <VerticalStack>
            <HorizontalStack addClassName="items-center">
              <UserAvatar user={message.author} size="lg" />
              <div>
                <Typography>{message.author.name}</Typography>
                <Typography color="textSecondary">
                  {message.author.username}
                </Typography>
              </div>
            </HorizontalStack>
            <div className="flex justify-center">
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  globalModal.openModal({
                    props: { title: "User profile" },
                    content: (
                      <LoadingBoundary>
                        <UserProfile userId={message.author.id} />
                      </LoadingBoundary>
                    ),
                  });
                  userPopover.closePopover();
                }}
              >
                View full profile
              </Button>
            </div>
          </VerticalStack>
        </Section>
      </userPopover.ReadyComponent>
      <reactionsPopover.ReadyComponent disablePortal>
        <LoadingBoundary>
          {!message.isOptimistic && (
            <MessageReactionPicker
              message={message}
              onReactionClick={onReactionClick}
            />
          )}
        </LoadingBoundary>
      </reactionsPopover.ReadyComponent>
    </div>
  );
};

export default Message;
