import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import {
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

type CommentProps = {
  comment: RenderedMessage;
  shouldHighlight?: boolean;
  onHighlightConsumed?: () => void;
  onUpdateSuccess: MessageUpdateMutationOptions["onSuccess"];
  onDeleteSuccess: MessageDeleteMutationOptions["onSuccess"];
  onOptimisticRetry?: (m: RenderedMessage) => void;
  onOptimisticDelete?: (m: RenderedMessage) => void;
};

export const Comment = ({
  comment,
  shouldHighlight,
  onHighlightConsumed,
  onUpdateSuccess,
  onDeleteSuccess,
  onOptimisticRetry,
  onOptimisticDelete,
}: CommentProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [editInfo, setEditInfo] = useState(comment);

  const user = useUser();
  const menuPopover = useLocalPopover();
  const isDesktop = useIsDesktop();

  const commentsDeleteMutation = trpc.messages.delete.useMutation({
    onSuccess: onDeleteSuccess,
  });

  const commentUpdateMutation = trpc.messages.update.useMutation({
    onSuccess: (...args) => {
      setIsEdit(false);
      onUpdateSuccess?.(...args);
    },
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

  const MoreButton = (
    <Tooltip title="More">
      <IconButton size="small" onClick={menuPopover.openPopover}>
        <MoreVertIcon />
      </IconButton>
    </Tooltip>
  );

  const isOwnMessage = comment.user_id === user.data?.user?.id;

  return (
    <div className={comment.isCompact ? "" : "pt-2"}>
      <HorizontalStack
        ref={ref}
        addClassName={clsx(
          defaultPaddingXs,
          "relative justify-between group hover:bg-[var(--mui-palette-action-focus)]"
        )}
        wrap={false}
      >
        <HorizontalStack wrap={false}>
          {user.data?.user && !comment.isCompact ? (
            <UserAvatar
              user={
                isOwnMessage
                  ? user.data.user
                  : { username: user.data.user.username, id: user.data.user.id }
              }
            />
          ) : (
            <div className="min-w-8" />
          )}
          <VerticalStack spacing="xs" fullWidth={false}>
            {!comment.isCompact && (
              <HorizontalStack addClassName="items-center">
                <Typography>
                  <strong>{user.data?.user?.name}</strong>
                </Typography>
                <Tooltip
                  title={dayjs(comment.created_at).format(
                    dateTimeFormatFullDisplay
                  )}
                >
                  <Typography variant="subtitle2" color="textSecondary">
                    {dayjs(comment.created_at).format(timeFormat)}
                  </Typography>
                </Tooltip>
              </HorizontalStack>
            )}
            ID: {comment.id} | Content: {comment.content}
          </VerticalStack>
        </HorizontalStack>
        {isDesktop ? (
          <Paper
            elevation={4}
            className={clsx(
              "absolute -top-6 right-2 flex",
              !menuPopover.isOpen && "opacity-0 pointer-events-none",
              "group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
            )}
          >
            <HorizontalStack addClassName="p-1" spacing="none">
              <IconButton size="small">
                <AddReactionIcon />
              </IconButton>
              {MoreButton}
            </HorizontalStack>
          </Paper>
        ) : (
          MoreButton
        )}
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
            <Divider />
            {isOwnMessage ? (
              <>
                <MenuItem>
                  <ListItemIcon>
                    <EditIcon />
                  </ListItemIcon>
                  <ListItemText>Edit Message</ListItemText>
                </MenuItem>
                <Popconfirm title="Are you sure you want to delete this message?">
                  <MenuItem
                    sx={(theme) => ({ color: theme.palette.error.main })}
                  >
                    <ListItemIcon>
                      <DeleteIcon color="error" />
                    </ListItemIcon>
                    <ListItemText>Delete Message</ListItemText>
                  </MenuItem>
                </Popconfirm>
              </>
            ) : (
              <MenuItem sx={(theme) => ({ color: theme.palette.warning.main })}>
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

  return (
    <div ref={ref} className={clsx("p-2 flex flex-wrap gap-3")}>
      {isEdit ? (
        <>
          <input
            className="border block p-3 w-52"
            value={editInfo.content}
            onChange={(e) => {
              setEditInfo((prev) => ({
                ...prev,
                content: e.target.value,
              }));
            }}
          />
          <Button
            variant="outlined"
            onClick={() => {
              commentUpdateMutation.mutate({
                content: editInfo.content,
                id: editInfo.id,
                channelId: editInfo.channel_id,
              });
            }}
            disabled={commentUpdateMutation.isPending}
          >
            Save
          </Button>
        </>
      ) : (
        <>
          <h6 className="word-break-word text-red-500">
            {comment.deleted_at
              ? "(Deleted)"
              : comment.isOptimistic
                ? "PENDING"
                : ""}
          </h6>
          <h6 className="word-break-word">{comment.id}</h6>
          <h5 className="word-break-word">{comment.content}</h5>
          {comment.isFailed ? (
            <>
              <h6 className="word-break-word text-red-500">Failed. Retry?</h6>
              <Button
                variant="outlined"
                onClick={() => {
                  onOptimisticRetry?.(comment);
                }}
              >
                Retry optimistic
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  onOptimisticDelete?.(comment);
                }}
              >
                Delete optimistic
              </Button>
            </>
          ) : null}
          <Button
            variant="outlined"
            onClick={() => {
              setEditInfo(comment);
              setIsEdit(true);
            }}
          >
            Edit
          </Button>
        </>
      )}

      {isEdit ? (
        <Button
          variant="outlined"
          onClick={() => {
            setEditInfo(comment);
            setIsEdit(false);
          }}
        >
          Cancel
        </Button>
      ) : (
        <Button
          variant="outlined"
          onClick={() => {
            commentsDeleteMutation.mutate({ id: comment.id });
          }}
          disabled={commentsDeleteMutation.isPending}
        >
          Delete
        </Button>
      )}
    </div>
  );
};

// const CommentsList = () => {
//   const comments = useAppQuery(
//     trpc.messages.get.useQuery(undefined, { staleTime: 15000 })
//   );
//   return (
//     <div className="mt-5 w-full">
//       {comments.status !== "success" ? (
//         <h5>Loading comments...</h5>
//       ) : (
//         <Virtuoso
//           useWindowScroll
//           //style={{ height: "500px" }}
//           data={comments.data}
//           itemContent={(_, comment) => {
//             return <Comment comment={comment} />;
//           }}
//         />
//       )}
//     </div>
//   );
// };

// export default CommentsList;
