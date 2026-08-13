import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import UserAvatar from "@/components/Avatar/UserAvatar";
import Button from "@/components/Button/Button";
import debounce from "lodash/debounce";
import { Virtuoso } from "react-virtuoso";
import { Paper, Typography, useMediaQuery } from "@mui/material";

import ButtonBase from "@/components/Button/ButtonBase";
import { AnimatedNumber } from "@/components/Chat/AnimatedNumber";
import type { ServerRenderedMessage } from "@/components/Chat/Message";
import type { EnrichedReaction } from "@/components/Chat/MessageReactionList";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import { SwitchingDivider } from "@/components/Layout/Dividers";
import RefreshIcon from "@mui/icons-material/Refresh";
import Tooltip from "@/components/Tooltip/Tooltip";
import { trpc } from "@/trpc";
import { CACHE_TIME_MS } from "@/utils/cacheTime";
import useAppQuery from "@/utils/hooks/useAppQuery";
import { useLatest } from "@/utils/hooks/useLatest";
import useMobileSlider from "@/utils/hooks/useMobileSlider";
import { useLocalModal } from "@/utils/hooks/useOverlay";
import clsx from "clsx";
import { MessagesSkeleton } from "@/components/Chat/MessagesSkeleton";
import { useEffectAfterMount } from "@/utils/hooks/useEffectAfterMount";
import Collapse from "@/components/Collapse/Collapse";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import UserProfile from "@/components/Chat/UserProfile";

const FETCH_MORE_THRESHOLD = 2;

type MessageReactionUsersOptions = NonNullable<
  Parameters<typeof trpc.messages.getMessageReactions.useInfiniteQuery>[1]
>;

const messageReactionUsersQueryOptions = {
  getNextPageParam: (lastPage) => {
    const lastId =
      lastPage.items[lastPage.items.length - 1]?.message_reaction_id;
    return lastId
      ? {
          id: lastId,
        }
      : undefined;
  },
  select(data) {
    return {
      ...data,
      items: data.pages.flatMap((page) => page.items),
    };
  },
  staleTime: CACHE_TIME_MS.NORMAL,
} satisfies MessageReactionUsersOptions;

const useMessageReactionUsers = ({
  messageId,
  reactionId,
}: {
  messageId: number;
  reactionId: number;
}) => {
  return useAppQuery(
    trpc.messages.getMessageReactions.useInfiniteQuery(
      { messageId, reactionId },
      messageReactionUsersQueryOptions
    )
  );
};

type Props = {
  message: ServerRenderedMessage;
  reactions: EnrichedReaction[];
  initialReactionId: number;
};

const ReactionsInfiniteList = ({
  messageReactionUsers,
  isStale,
  invalidateAllReactions,
}: {
  messageReactionUsers: ReturnType<typeof useMessageReactionUsers>;
  isStale: boolean;
  invalidateAllReactions: () => void;
}) => {
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  const [isIdleTrigger, setIsIdleTrigger] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchMoreTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef<boolean>(false);
  const visibleRangeRef = useRef<{
    visibleStartIndex: number;
    visibleEndIndex: number;
  } | null>(null);

  const userProfileModal = useLocalModal();
  const clearFetchMoreTimeout = () => {
    if (fetchMoreTimeout.current) {
      clearTimeout(fetchMoreTimeout.current);
    }
  };

  // eslint-disable-next-line
  const debouncedMakeIdle = useCallback(
    // eslint-disable-next-line
    debounce(() => {
      setIsIdleTrigger((prev) => (prev % 10) + 1);
      isIdleRef.current = true;
    }, 100),
    []
  );

  const dependencies = useLatest({
    messageReactionUsers,
  });

  const tryLoadOlder = useCallback(
    async (bypassExistingError?: boolean) => {
      const { messageReactionUsers } = dependencies.current;

      if (!bypassExistingError && messageReactionUsers.isFetchNextPageError) {
        return;
      }

      await messageReactionUsers.fetchNextPage({ cancelRefetch: false });
    },
    [dependencies]
  );

  const totalItems = messageReactionUsers.data?.items.length || 0;

  useEffect(() => {
    if (!messageReactionUsers.hasNextPage || !visibleRangeRef.current) {
      return;
    }

    const visibleEndIndex = visibleRangeRef.current.visibleEndIndex;

    if (
      isIdleRef.current &&
      visibleEndIndex >= totalItems - 1 - FETCH_MORE_THRESHOLD &&
      messageReactionUsers.hasNextPage &&
      !messageReactionUsers.isFetching &&
      !messageReactionUsers.isError
    ) {
      clearFetchMoreTimeout();
      fetchMoreTimeout.current = setTimeout(() => {
        tryLoadOlder();
      }, 50);
    }
    return clearFetchMoreTimeout;
  }, [
    isIdleTrigger,
    totalItems,
    tryLoadOlder,
    messageReactionUsers.isFetching,
    messageReactionUsers.isError,
    messageReactionUsers.hasNextPage,
  ]);

  useEffect(() => {
    return () => {
      debouncedMakeIdle.cancel();
    };
  }, [debouncedMakeIdle]);

  const virtuosoContext = useMemo(
    () => ({
      messageReactionUsers: {
        hasNextPage: messageReactionUsers.hasNextPage,
        isError: messageReactionUsers.isError,
        isFetchNextPageError: messageReactionUsers.isFetchNextPageError,
        isFetchingNextPage: messageReactionUsers.isFetchingNextPage,
      },

      tryLoadOlder,
      isIdleTrigger,
    }),
    [
      messageReactionUsers.hasNextPage,
      messageReactionUsers.isError,
      messageReactionUsers.isFetchNextPageError,
      messageReactionUsers.isFetchingNextPage,

      tryLoadOlder,
      isIdleTrigger,
    ]
  );

  const MessagesFooter = useMemo(
    () =>
      ({ context }: { context: typeof virtuosoContext }) => {
        const { messageReactionUsers, tryLoadOlder } = context;
        if (messageReactionUsers.isFetchNextPageError) {
          return (
            <VerticalStack withPadding addClassName="items-center">
              <Typography color="warning" variant="body2">
                Failed to load older reactions
              </Typography>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={() => tryLoadOlder(true)}
                isLoading={messageReactionUsers.isFetchingNextPage}
                size="large"
                className="w-fit"
              >
                Retry
              </Button>
            </VerticalStack>
          );
        }

        if (messageReactionUsers.hasNextPage) {
          return <MessagesSkeleton fixedRowCount={3} withPadding={false} />;
        }

        return null;
      },
    []
  );

  const hasBlockingError =
    !messageReactionUsers.isFetchNextPageError && messageReactionUsers.isError;

  const VirtuosoComponents = useMemo(
    () => ({
      //List: VerticalStack,
      Footer: MessagesFooter,
    }),
    [MessagesFooter]
  );

  if (messageReactionUsers.isLoading) {
    return (
      <div className="flex-1">
        <MessagesSkeleton fixedRowCount={3} withPadding={false} />
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-y-auto" ref={setScrollParent}>
      <Collapse in={isStale || hasBlockingError} className="sticky top-2 z-10">
        <div className="flex pb-4 justify-center">
          <Paper
            className="flex items-center gap-2 py-1 px-2 ring-2 ring-mui-warning-main"
            elevation={2}
          >
            <Typography variant="subtitle2">
              {hasBlockingError
                ? "Failed to load reactions"
                : "Reactions changed"}
            </Typography>
            <Button
              variant="contained"
              color={hasBlockingError ? "warning" : "primary"}
              size="small"
              startIcon={<RefreshIcon />}
              onClick={invalidateAllReactions}
              disabled={messageReactionUsers.isRefetching}
            >
              {hasBlockingError ? "Retry" : "Refresh"}
            </Button>
          </Paper>
        </div>
      </Collapse>
      <Virtuoso
        customScrollParent={scrollParent!}
        data={messageReactionUsers.data?.items}
        computeItemKey={(_, item) => item.message_reaction_id}
        rangeChanged={(range) => {
          visibleRangeRef.current = {
            visibleStartIndex: range.startIndex,
            visibleEndIndex: range.endIndex,
          };
          isIdleRef.current = false;
          debouncedMakeIdle();
        }}
        increaseViewportBy={{
          bottom: 100,
          top: 100,
        }}
        overscan={{
          main: 200,
          reverse: 200,
        }}
        totalListHeightChanged={() => {
          isIdleRef.current = false;
          debouncedMakeIdle();
        }}
        context={virtuosoContext}
        components={VirtuosoComponents}
        itemContent={(_, item) => (
          <ButtonBase
            className="rounded-lg p-2 w-full text-left justify-start hover:bg-mui-action-focus transition"
            onClick={() => {
              setSelectedUserId(item.author.id);
              userProfileModal.openModal();
            }}
            disabled={!item.author.username}
          >
            <HorizontalStack
              wrap={false}
              spacing="xs"
              addClassName="items-center"
            >
              <UserAvatar user={item.author} size="md" />
              <VerticalStack spacing="none" fullWidth={false}>
                <Typography>{item.author.name}</Typography>
                <Typography color="textSecondary">
                  {item.author.username}
                </Typography>
              </VerticalStack>
            </HorizontalStack>
          </ButtonBase>
        )}
      />
      <userProfileModal.ReadyComponent title="User Profile">
        {!!selectedUserId && (
          <LoadingBoundary>
            <UserProfile userId={selectedUserId} />
          </LoadingBoundary>
        )}
      </userProfileModal.ReadyComponent>
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
  const [isStale, setIsStale] = useState(false);

  const messageReactionUsers = useMessageReactionUsers({
    messageId: message.id,
    reactionId: selectedReactionId,
  });

  const utils = trpc.useUtils();
  const isLargeScreen = useMediaQuery((theme) => theme.breakpoints.up("md"));

  const { parentRef: mobileSliderParentRef, ...mobileSlider } =
    useMobileSlider();

  const reactionsVersion = useMemo(
    () =>
      JSON.stringify(
        reactions.map((x) => [x.reaction_id, x.reacted_by_me, x.reaction_count])
      ),
    [reactions]
  );

  useEffectAfterMount(() => {
    setIsStale(true);
  }, [reactionsVersion]);

  useEffect(() => {
    if (
      !reactions.some((x) => x.reaction_id === selectedReactionId) &&
      reactions.length
    ) {
      setSelectedReactionId(reactions[0].reaction_id);
    }
  }, [reactions, selectedReactionId]);

  useEffect(() => {
    return () => {
      utils.messages.getMessageReactions.invalidate({
        messageId: message.id,
      });
    };
  }, [utils.messages.getMessageReactions, message.id]);

  return (
    <div className="flex flex-col gap-4 pt-1 md:flex-row min-h-[300px] h-[min(500px,60dvh)] relative">
      <div className="relative">
        <div
          className="w-full flex md:max-w-[120px] md:flex-col md:overflow-y-auto max-md:overflow-x-auto gap-2"
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
        messageReactionUsers={messageReactionUsers}
        isStale={isStale}
        invalidateAllReactions={() => {
          setIsStale(false);
          utils.messages.getMessageReactions.invalidate({
            messageId: message.id,
          });
        }}
      />
    </div>
  );
};

export default MessageReactionUserList;
