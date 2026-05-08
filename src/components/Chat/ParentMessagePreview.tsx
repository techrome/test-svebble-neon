import React, { useMemo } from "react";
import ReplyIcon from "@mui/icons-material/Reply";

import { type RenderedMessage } from "@/components/Chat/Message";
import { HorizontalStack } from "@/components/Layout/Containers";
import { Typography } from "@mui/material";
import Link from "@/components/Link/Link";
import ButtonBase from "@/components/Button/ButtonBase";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useIsTextTruncated } from "@/utils/hooks/useIsTextTruncated";
import { messageContentPreviewMaxLength } from "@/utils/validators/shared/messages";
import UserAvatar from "@/components/Avatar/UserAvatar";

type Props = {
  message: RenderedMessage;
  parentMessageUpdatedAtFull: string | null;
};

const ParentMessagePreview = ({
  message,
  parentMessageUpdatedAtFull,
}: Props) => {
  const { isTruncated, ref } = useIsTextTruncated(
    message.parentMessage?.contentPreview
  );

  const contentPreview = useMemo(() => {
    const previewText = message.parentMessage?.contentPreview;
    if (previewText) {
      return isTruncated
        ? previewText
        : previewText.length >= messageContentPreviewMaxLength
          ? `${previewText.slice(0, messageContentPreviewMaxLength - 1)}...`
          : previewText;
    }
    return "";
  }, [message.parentMessage?.contentPreview, isTruncated]);

  return !message.isOptimistic && !message.parentMessage ? (
    <HorizontalStack
      addClassName="pl-6 pr-1 items-center text-mui-text-secondary"
      fullWidth
      spacing="xs"
    >
      <ReplyIcon fontSize="small" className="-scale-x-100" />
      <Typography>Message was deleted</Typography>
    </HorizontalStack>
  ) : (
    <ButtonBase
      focusRipple
      className="no-underline w-full hover:cursor-pointer hover:bg-mui-action-selected text-mui-text-secondary"
      component={Link}
      href={`?messageId=${message.reply_to_message_id}`}
    >
      <HorizontalStack
        addClassName="pl-6 pr-1 gap-1 items-center"
        fullWidth
        spacing="none"
        wrap={false}
      >
        <ReplyIcon fontSize="small" className="-scale-x-100" />
        <UserAvatar user={message.parentMessage?.author} size="xs" />
        <Typography
          component={"span"}
          className="text-ellipsis opacity-80 whitespace-nowrap overflow-hidden"
          variant="subtitle2"
          color="secondary"
        >
          <strong>
            {message.parentMessage
              ? message.parentMessage.author.name
              : "Loading..."}
          </strong>
        </Typography>
        <div className="flex items-center gap-1 overflow-hidden">
          <Typography
            className="text-ellipsis whitespace-nowrap overflow-hidden"
            ref={ref}
            variant="subtitle2"
          >
            {contentPreview}
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
  );
};

export default ParentMessagePreview;
