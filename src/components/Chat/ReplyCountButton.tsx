import React, { useEffect, useMemo, useState } from "react";
import { Paper, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ReplayIcon from "@mui/icons-material/Replay";
import clsx from "clsx";

import { type RenderedMessage } from "@/components/Chat/Message";
import {
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import { useLocalPopover } from "@/utils/hooks/useOverlay";
import { type RouterOutput, trpc } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import {
  messageContentPreviewMaxLength,
  messageRepliesPageMaxSize,
} from "@/utils/validators/shared/messages";
import { CACHE_TIME_MS } from "@/utils/cacheTime";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import UserAvatar from "@/components/Avatar/UserAvatar";
import dayjs from "@/utils/dayjs";
import {
  dateTimeFormat,
  dateTimeFormatFullDisplay,
  timeFormat,
} from "@/utils/dateFormats";
import Pagination from "@/components/Pagination/Pagination";
import Skeleton from "@/components/Skeleton/Skeleton";
import Button from "@/components/Button/Button";
import Tooltip from "@/components/Tooltip/Tooltip";
import ButtonBase from "@/components/Button/ButtonBase";
import Link from "@/components/Link/Link";

type ReplyMessage = RouterOutput["messages"]["getReplies"]["items"][number];

type ReplyMessageProps = {
  message: ReplyMessage;
  onReplyClick: () => void;
};

type ReplyListProps = {
  message: RenderedMessage;
  onReplyClick: () => void;
};

type Props = {
  message: RenderedMessage;
};

const ReplyMessage = ({ message, onReplyClick }: ReplyMessageProps) => {
  const { createdAtShort, createdAtFull, updatedAtFull } = useMemo(() => {
    const createdAt = dayjs(message.created_at);
    const isToday = createdAt.isSame(dayjs(), "day");
    const createdAtShort = isToday
      ? createdAt.format(timeFormat)
      : createdAt.format(dateTimeFormat);
    const createdAtFull = createdAt.format(dateTimeFormatFullDisplay);
    const hasEdited =
      message.created_at.getTime() !== message.edited_at.getTime();
    const updatedAtFull = hasEdited
      ? dayjs(message.edited_at).format(dateTimeFormatFullDisplay)
      : null;

    return { createdAtShort, createdAtFull, updatedAtFull };
  }, [message.created_at, message.edited_at]);
  return (
    <Link
      href={`?messageId=${message.id}`}
      className="w-full md:w-1/2 no-underline text-mui-text-primary"
      onClick={onReplyClick}
    >
      <ButtonBase
        focusRipple
        className="w-full p-2 hover:cursor-pointer hover:bg-mui-action-focus text-left"
      >
        <HorizontalStack wrap={false} addClassName="w-full items-center">
          <UserAvatar user={message.author} size="sm" />
          <div className="flex flex-col overflow-hidden">
            <HorizontalStack wrap={false} spacing="xs">
              <Typography
                variant="subtitle2"
                className="text-ellipsis whitespace-nowrap overflow-hidden"
              >
                <strong>{message.author.name}</strong>
              </Typography>
              <Tooltip title={createdAtFull}>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  className="whitespace-nowrap"
                >
                  {createdAtShort}
                </Typography>
              </Tooltip>
            </HorizontalStack>
            <HorizontalStack wrap={false} spacing="xs">
              <Typography
                variant="caption"
                className="text-ellipsis whitespace-nowrap overflow-hidden"
              >
                {message.contentPreview}
              </Typography>
              {updatedAtFull ? (
                <Tooltip title={updatedAtFull}>
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
            </HorizontalStack>
          </div>
        </HorizontalStack>
      </ButtonBase>
    </Link>
  );
};

const calculateTotalPages = (totalItems: number, pageSize: number) =>
  Math.max(1, Math.ceil(totalItems / pageSize));

const ReplyList = ({ message, onReplyClick }: ReplyListProps) => {
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: calculateTotalPages(
      message.reply_count,
      messageRepliesPageMaxSize
    ),
    totalItems: message.reply_count,
    pageSize: messageRepliesPageMaxSize,
  });

  const replies = useAppQuery(
    trpc.messages.getReplies.useQuery(
      {
        messageId: String(message.id),
        page: pagination.page,
        pageSize: pagination.pageSize,
      },
      { staleTime: CACHE_TIME_MS.QUICK }
    )
  );
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!replies.isSuccess) return;

    setPagination((prev) => {
      const totalItems = replies.data.totalItems;
      const totalPages = calculateTotalPages(totalItems, prev.pageSize);

      return {
        ...prev,
        totalItems,
        totalPages: totalPages,
        page: Math.min(prev.page, totalPages),
      };
    });
  }, [replies.data, replies.isSuccess]);

  return (
    <Paper elevation={5}>
      <Section fullWidth={false} addClassName="w-2xl max-w-full">
        <VerticalStack>
          <VerticalStack>
            {pagination.totalPages > 1 && (
              <Typography>
                Showing{" "}
                {pagination.pageSize * pagination.page -
                  pagination.pageSize +
                  1}
                -
                {Math.min(
                  pagination.pageSize * pagination.page,
                  pagination.totalItems
                )}{" "}
                items out of {pagination.totalItems}
              </Typography>
            )}
            {replies.isLoading ? (
              <div>
                <Skeleton />
                <Skeleton />
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </div>
            ) : replies.isError ? (
              <VerticalStack
                addClassName="flex-1 justify-center items-center"
                withPadding
              >
                <Typography color="warning" variant="body2">
                  Failed to load replies
                </Typography>
                <Button
                  variant="contained"
                  color="inherit"
                  startIcon={<ReplayIcon />}
                  onClick={() => {
                    utils.messages.getReplies.invalidate();
                  }}
                  size="large"
                  className="w-fit"
                >
                  Retry
                </Button>
              </VerticalStack>
            ) : replies.data?.items.length ? (
              <HorizontalStack
                spacing="none"
                addClassName="max-h-[300px] overflow-y-auto"
              >
                {replies.data.items.map((reply) => (
                  <ReplyMessage
                    key={reply.id}
                    message={reply}
                    onReplyClick={onReplyClick}
                  />
                ))}
              </HorizontalStack>
            ) : null}
            {pagination.totalPages > 1 && (
              <Pagination
                count={pagination.totalPages}
                page={pagination.page}
                onChange={(_e, page) => {
                  setPagination((prev) => ({ ...prev, page }));
                }}
              />
            )}
          </VerticalStack>
        </VerticalStack>
      </Section>
    </Paper>
  );
};

const ReplyCountButton = ({ message }: Props) => {
  const popover = useLocalPopover();

  return (
    <>
      <ButtonBase
        focusRipple
        className="w-full hover:cursor-pointer hover:bg-mui-action-selected text-left"
      >
        <HorizontalStack
          addClassName="pl-3 pr-1 items-center"
          fullWidth
          spacing="xs"
          onClick={popover.openPopover}
        >
          <Typography color="textSecondary" className="flex items-center">
            Replies: {message.reply_count}
            <KeyboardArrowDownIcon
              fontSize="small"
              className={clsx("transition", popover.isOpen ? "rotate-180" : "")}
            />
          </Typography>
        </HorizontalStack>
      </ButtonBase>
      <popover.ReadyComponent>
        <LoadingBoundary>
          <ReplyList message={message} onReplyClick={popover.closePopover} />
        </LoadingBoundary>
      </popover.ReadyComponent>
    </>
  );
};

export default ReplyCountButton;
