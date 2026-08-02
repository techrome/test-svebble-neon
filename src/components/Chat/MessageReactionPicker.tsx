import React, { useMemo } from "react";

import {
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import { type RouterOutput } from "@/trpc";
import { useMessageReactions } from "@/trpc/hooks/useMessageReactions";
import Skeleton from "@/components/Skeleton/Skeleton";
import ButtonBase from "@/components/Button/ButtonBase";
import Tooltip from "@/components/Tooltip/Tooltip";
import { Typography } from "@mui/material";
import type {
  ServerRenderedMessage,
  ToggleMessageReaction,
} from "@/components/Chat/Message";
import { useAppSelector } from "@/redux/hooks";
import { getReactionKey } from "@/redux/slices/messageReactionsUI";
import LoadingOverlay from "@/components/LoadingOverlay/LoadingOverlay";
import { useDebouncedValue } from "@/utils/hooks/useDebouncedValue";
import clsx from "clsx";

export type ReactionData =
  RouterOutput["messages"]["getReactions"]["items"][number];

const UnicodeReactionButton = ({
  reaction,
  message,
  toggleReaction,
}: {
  reaction: ReactionData;
  message: ServerRenderedMessage;
  toggleReaction: ToggleMessageReaction;
}) => {
  const pendingReactions = useAppSelector(
    (state) => state.messageReactionsUI.pendingReactions
  );
  const messageId = message.id;
  const reactionId = reaction.id;
  const pendingReaction =
    pendingReactions[messageId]?.[getReactionKey(reactionId)];
  const isReactionPending = Boolean(pendingReaction);
  const isReactionActive = pendingReaction
    ? pendingReaction.shouldReact
    : message.reactions.find((x) => x.reaction_id === reaction.id)
        ?.reacted_by_me;
  const delayedIsReactionPending = useDebouncedValue(isReactionPending, 500, {
    instantOnFalsyValue: true,
  });

  return (
    <Tooltip
      title={reaction.slug}
      enterDelay={750}
      slotProps={{
        popper: {
          modifiers: [
            {
              name: "flip",
              enabled: false,
            },
          ],
        },
      }}
    >
      <LoadingOverlay
        isLoading={delayedIsReactionPending}
        className="rounded-lg"
      >
        <ButtonBase
          className={clsx(
            "group transition p-3 rounded-[inherit] hover:ring-2 hover:ring-mui-primary-main",
            isReactionActive && "bg-mui-primary-main/20"
          )}
          onClick={() => {
            if (isReactionPending) return;
            toggleReaction({
              messageId: message.id,
              reactionId: reaction.id,
              shouldReact: !isReactionActive,
            });
          }}
        >
          <Typography className="transition group-focus-visible:scale-150 group-hover:scale-150">
            {reaction.emoji}
          </Typography>
        </ButtonBase>
      </LoadingOverlay>
    </Tooltip>
  );
};

const MessageReactionPicker = ({
  message,
  onReactionClick,
}: {
  message: ServerRenderedMessage;
  onReactionClick: ToggleMessageReaction;
}) => {
  const reactions = useMessageReactions();

  const sortedReactions = useMemo(
    () =>
      reactions.data?.items.toSorted((a, b) => a.sort_order - b.sort_order) ||
      [],
    [reactions.data?.items]
  );

  return (
    <Section fullWidth={false} addClassName="min-w-xs max-w-md" padding="xs">
      <VerticalStack>
        <HorizontalStack fullWidth spacing="xxs">
          {reactions.isLoading ? (
            <Skeleton className="flex-1" />
          ) : reactions.isError ? (
            <Typography color="warning">Failed to fetch reactions</Typography>
          ) : (
            sortedReactions.map((x) => (
              <UnicodeReactionButton
                key={x.id}
                reaction={x}
                message={message}
                toggleReaction={onReactionClick}
              />
            ))
          )}
        </HorizontalStack>
      </VerticalStack>
    </Section>
  );
};

export default MessageReactionPicker;
