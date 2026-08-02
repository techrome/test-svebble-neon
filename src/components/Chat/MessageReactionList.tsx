import React, { useEffect, useMemo } from "react";
import { Typography } from "@mui/material";
import clsx from "clsx";

import ButtonBase from "@/components/Button/ButtonBase";
import { AnimatedNumber } from "@/components/Chat/AnimatedNumber";
import type {
  ServerRenderedMessage,
  ToggleMessageReaction,
} from "@/components/Chat/Message";
import type { ReactionData } from "@/components/Chat/MessageReactionPicker";
import { HorizontalStack } from "@/components/Layout/Containers";
import Skeleton from "@/components/Skeleton/Skeleton";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useMessageReactions } from "@/trpc/hooks/useMessageReactions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  getReactionKey,
  setPendingReaction,
} from "@/redux/slices/messageReactionsUI";
import LoadingOverlay from "@/components/LoadingOverlay/LoadingOverlay";
import { useDebouncedValue } from "@/utils/hooks/useDebouncedValue";

type EnrichedReaction = ServerRenderedMessage["reactions"][number] & {
  definition: ReactionData;
  isPending?: boolean;
};

const buttonClassName =
  "transition rounded-lg py-1 px-1.5 bg-mui-background-paper border-2 border-transparent [box-shadow:var(--mui-shadows-2)] [background-image:var(--mui-overlays-6)]";

const buttonHoverClassName =
  "hover:[background-image:var(--mui-overlays-8)] hover:text-mui-text-primary transition hover:border-mui-text-secondary";

const skeletonClassName = "w-13 h-9 transform-none";

const ReactionTooltip = ({ reaction }: { reaction: ReactionData }) => {
  //   return (
  //     <div className="w-2xl max-w-full px-2">
  //       <Skeleton />
  //     </div>
  //   );

  return (
    <ButtonBase className="flex items-center gap-1 p-2 rounded-md hover:bg-mui-action-focus transition">
      <Typography variant="h3" component={"p"}>
        {reaction.emoji}
      </Typography>
      <Typography>
        <strong>{reaction.slug}</strong> reacted by user_1
      </Typography>
    </ButtonBase>
  );
};

const ReactionButton = ({
  reaction,
  onClick,
}: {
  reaction: EnrichedReaction;
  onClick: () => void;
}) => {
  const delayedIsReactionPending = useDebouncedValue(
    Boolean(reaction.isPending),
    500,
    {
      instantOnFalsyValue: true,
      initialValue: false, // to avoid mounting with pending value right away
    }
  );

  if (reaction.reaction_count === 0 && !delayedIsReactionPending) {
    return null;
  }

  return (
    <LoadingOverlay isLoading={delayedIsReactionPending} className="rounded-lg">
      <Tooltip
        enterDelay={500}
        slotProps={{
          tooltip: {
            sx: {
              p: 0,
            },
          },
        }}
        title={<ReactionTooltip reaction={reaction.definition} />}
      >
        <ButtonBase
          className={clsx(
            buttonClassName,
            reaction.reacted_by_me
              ? "!border-mui-primary-main !bg-[color-mix(in_srgb,var(--mui-palette-primary-main)_10%,var(--mui-palette-background-paper))] !text-mui-text-primary [background-image:var(--mui-overlays-8)]"
              : buttonHoverClassName
          )}
          onClick={onClick}
        >
          <div className="flex gap-1 items-center">
            <Typography>{reaction.definition.emoji}</Typography>
            <Typography>
              <AnimatedNumber value={reaction.reaction_count} />
            </Typography>
          </div>
        </ButtonBase>
      </Tooltip>
    </LoadingOverlay>
  );
};

const MessageReactionList = ({
  message,
  toggleReaction,
}: {
  message: ServerRenderedMessage;
  toggleReaction: ToggleMessageReaction;
}) => {
  const pendingReactions = useAppSelector(
    (state) => state.messageReactionsUI.pendingReactions
  );
  const dispatch = useAppDispatch();

  const reactions = useMessageReactions();
  const pendingMessageReactions = pendingReactions[message.id];

  const { enrichedReactions, hasActiveReaction } = useMemo(() => {
    const reactionDefinitions = reactions.data?.items;
    let hasActiveReaction = false;
    if (!reactionDefinitions?.length) {
      return { enrichedReactions: [], hasActiveReaction };
    }

    let fullEnrichedReactions = message.reactions.flatMap((x) => {
      const definition = reactionDefinitions.find(
        (def) => def.id === x.reaction_id
      );
      const pendingReaction =
        pendingMessageReactions?.[getReactionKey(x.reaction_id)];

      if (!definition) return [];

      const enrichedReaction: EnrichedReaction = {
        ...x,
        definition,
        ...(pendingReaction && {
          reacted_by_me: pendingReaction.shouldReact,
          reaction_count:
            x.reaction_count +
            (x.reacted_by_me === pendingReaction.shouldReact
              ? 0
              : pendingReaction.shouldReact
                ? 1
                : -1),
          isPending: true,
        }),
      };
      if (enrichedReaction.reaction_count > 0) {
        hasActiveReaction = true;
      }
      return [enrichedReaction];
    });

    for (const pendingReaction of Object.values(
      pendingMessageReactions || {}
    )) {
      if (!pendingReaction) continue;

      const definition = reactionDefinitions.find(
        (def) => def.id === pendingReaction.reactionId
      );

      if (
        pendingReaction.shouldReact &&
        definition &&
        !fullEnrichedReactions.some(
          (x) => x.reaction_id === pendingReaction.reactionId
        )
      ) {
        hasActiveReaction = true;
        fullEnrichedReactions.push({
          reacted_by_me: true,
          reaction_count: 1,
          reaction_id: pendingReaction.reactionId,
          definition,
          isPending: true,
        });
      }
    }

    return { enrichedReactions: fullEnrichedReactions, hasActiveReaction };
  }, [reactions.data?.items, message.reactions, pendingMessageReactions]);

  useEffect(() => {
    if (!pendingMessageReactions) {
      return;
    }

    for (const pendingReaction of Object.values(pendingMessageReactions)) {
      if (!pendingReaction) continue;

      const serverReaction = message.reactions.find(
        (reaction) => reaction.reaction_id === pendingReaction.reactionId
      );

      const serverMatchesMyReaction =
        (serverReaction?.reacted_by_me || false) ===
        pendingReaction.shouldReact;

      if (serverMatchesMyReaction) {
        dispatch(
          setPendingReaction({
            messageId: message.id,
            reactionId: pendingReaction.reactionId,
            shouldReact: pendingReaction.shouldReact,
            isPending: false,
          })
        );
      }
    }
  }, [dispatch, message.id, message.reactions, pendingMessageReactions]);

  if ((reactions.isLoading && message.reactions.length) || reactions.isError) {
    return (
      <HorizontalStack addClassName="items-center py-1" fullWidth spacing="xs">
        {reactions.isLoading ? (
          <>
            <Skeleton className={skeletonClassName} withDefaultHeight={false} />
            <Skeleton className={skeletonClassName} withDefaultHeight={false} />
            <Skeleton className={skeletonClassName} withDefaultHeight={false} />
          </>
        ) : (
          <Typography color="warning">Failed to fetch reactions</Typography>
        )}
      </HorizontalStack>
    );
  }

  if (!enrichedReactions.length || !hasActiveReaction) return null;

  return (
    <HorizontalStack
      addClassName={clsx("items-center", enrichedReactions.length && "py-1")}
      fullWidth
      spacing="xs"
    >
      {enrichedReactions.map((reaction) => (
        <ReactionButton
          key={reaction.definition.id}
          reaction={reaction}
          onClick={() => {
            if (
              pendingMessageReactions?.[getReactionKey(reaction.definition.id)]
            ) {
              return;
            }
            toggleReaction({
              messageId: message.id,
              reactionId: reaction.definition.id,
              shouldReact: !reaction.reacted_by_me,
            });
          }}
        />
      ))}
    </HorizontalStack>
  );
};

export default MessageReactionList;
