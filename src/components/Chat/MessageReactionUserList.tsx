import ButtonBase from "@/components/Button/ButtonBase";
import { AnimatedNumber } from "@/components/Chat/AnimatedNumber";
import type { ServerRenderedMessage } from "@/components/Chat/Message";
import type { EnrichedReaction } from "@/components/Chat/MessageReactionList";
import { VerticalStack } from "@/components/Layout/Containers";
import { SwitchingDivider } from "@/components/Layout/Dividers";
import Tooltip from "@/components/Tooltip/Tooltip";
import { trpc } from "@/trpc";
import { CACHE_TIME_MS } from "@/utils/cacheTime";
import useAppQuery from "@/utils/hooks/useAppQuery";
import useMobileSlider from "@/utils/hooks/useMobileSlider";
import { Typography, useMediaQuery } from "@mui/material";
import clsx from "clsx";
import React, { useState } from "react";
import { Virtuoso } from "react-virtuoso";

type MessageReactionUsersOptions = NonNullable<
  Parameters<typeof trpc.messages.getMessageReactions.useInfiniteQuery>[1]
>;

const messageReactionUsersQueryOptions = {
  getNextPageParam: (lastPage) => {
    return {
      id:
        lastPage.items[lastPage.items.length - 1]?.message_reaction_id ||
        undefined,
    };
  },
  select(data) {
    return {
      ...data,
      items: data.pages.flatMap((page) => page.items),
    };
  },
  staleTime: CACHE_TIME_MS.NORMAL,
} satisfies MessageReactionUsersOptions;

type Props = {
  message: ServerRenderedMessage;
  reactions: EnrichedReaction[];
  initialReactionId: number;
};

const ReactionsInfiniteList = ({
  messageId,
  reactionId,
}: {
  messageId: number;
  reactionId: number;
}) => {
  const messageReactionUsers = useAppQuery(
    trpc.messages.getMessageReactions.useInfiniteQuery(
      { messageId, reactionId },
      messageReactionUsersQueryOptions
    )
  );

  if (messageReactionUsers.isLoading) {
    return <div>Loading...</div>;
  }
  if (messageReactionUsers.isError) {
    return <div>Failed to fetch message reaction users</div>;
  }

  return (
    <div className="flex-1">
      <Virtuoso
        style={{ height: "100%", width: "100%" }}
        data={messageReactionUsers.data?.items}
        components={{
          List: VerticalStack,
        }}
        computeItemKey={(_, item) => item.message_reaction_id}
        itemContent={(_, item) => <div>{item.author.name}</div>}
      />
    </div>
  );
};

const MessageReactionUserList = ({
  message,
  initialReactionId,
  reactions,
}: Props) => {
  const [selectedReactionId, setSelectedReactionId] =
    useState(initialReactionId);
  const isLargeScreen = useMediaQuery((theme) => theme.breakpoints.up("md"));

  const { parentRef: mobileSliderParentRef, ...mobileSlider } =
    useMobileSlider();

  return (
    <div className="flex flex-col gap-4 pt-1 md:flex-row">
      <div className="relative">
        <div
          className="w-full flex md:max-w-[120px] md:flex-col md:max-h-[500px] md:overflow-y-auto max-md:overflow-x-auto gap-2"
          onScroll={mobileSlider.handleScroll}
          ref={mobileSliderParentRef}
        >
          {reactions.map((reaction) => (
            <Tooltip
              key={reaction.reaction_id}
              title={reaction.definition.slug}
              placement={isLargeScreen ? "left" : "top"}
            >
              <ButtonBase
                className={clsx(
                  "max-md:text-nowrap justify-start md:w-full rounded-lg transition px-3 py-2 hover:text-mui-text-primary hover:ring-mui-text-primary",
                  reaction.reaction_id === selectedReactionId
                    ? "bg-mui-primary-main/20"
                    : "text-mui-text-secondary hover:bg-mui-action-focus"
                )}
                onClick={() => {
                  setSelectedReactionId(reaction.reaction_id);
                }}
              >
                <Typography variant="h6" sx={{ lineHeight: 1 }}>
                  {reaction.definition.emoji}
                </Typography>
                <Typography>
                  <AnimatedNumber value={reaction.reaction_count} />
                </Typography>
              </ButtonBase>
            </Tooltip>
          ))}
        </div>
        {mobileSlider.buttons.left}
        {mobileSlider.buttons.right}
      </div>
      <SwitchingDivider
        belowBreakpointOrientation="horizontal"
        aboveBreakpointFlexItem
      />
      <ReactionsInfiniteList
        messageId={message.id}
        reactionId={selectedReactionId}
      />
    </div>
  );
};

export default MessageReactionUserList;
