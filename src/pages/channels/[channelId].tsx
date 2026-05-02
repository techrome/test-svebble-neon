import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@/components/Button/Button";
import clsx from "clsx";
import PersonIcon from "@mui/icons-material/Person";
import { Paper, Typography } from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import ReplyIcon from "@mui/icons-material/Reply";
import ClearIcon from "@mui/icons-material/Clear";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import debounce from "lodash/debounce";
import z from "@/utils/zod";
import { getQueryKey, type TRPCClientErrorLike } from "@trpc/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";

import { type RouterInput, RouterOutput, trpc } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import MessageComponent, {
  type RenderedMessage,
  type Message,
} from "@/components/Chat/Message";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import { useGlobalModal } from "@/utils/hooks/useOverlay";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import { useAppSnackbar } from "@/utils/snackbar";
import { CACHE_TIME_MS, minutes, seconds } from "@/utils/cacheTime";
import IconButton from "@/components/Button/IconButton";
import Tooltip from "@/components/Tooltip/Tooltip";
import { userLoginLifecycle } from "@/trpc/helpers/userLifecycle";
import {
  type InfiniteData,
  type UseInfiniteQueryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { Text } from "@/utils/validators/helpers/text";
import { useUser } from "@/trpc/hooks/useUser";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/Fields/Input";
import { type AppPage } from "@/pages/_app";
import { useAuthModal } from "@/utils/hooks/useAuthModal";
import {
  type MessageCreateFormValues,
  makeMessageCreateSchemaForm,
} from "@/utils/validators/client/messages";
import { getRouterQueryValue } from "@/utils/query";
import {
  getChannelId,
  subscribeWs,
  type WebsocketPayload,
  type WebsocketItem,
  type MessageSerializable,
  type WebsocketEventsOriginal,
  type WebsocketEvents,
  WebsocketEventName,
} from "@/trpc/helpers/websockets";
import ChannelListWrapper from "@/components/Chat/ChannelList";
import { numericIdQuerySchemaRaw } from "@/utils/validators/helpers/custom";
import { TermsLabel } from "@/components/AuthForm/Helpers";
import { useWsClient } from "@/components/WebsocketsProvider/WebsocketsProvider";
import { MessagesSkeleton } from "@/components/Chat/MessagesSkeleton";
import { isSameDay, isWithinMs } from "@/utils/timeUtils";
import ReportMessageForm from "@/components/Chat/ReportMessageForm";
import ChannelHeader from "@/components/Chat/ChannelHeader";
import type { AppRouter } from "@/server";
import MessageEditor from "@/components/Chat/MessageEditor";
import { User } from "@/utils/validators/shared/user";
import { messageContentPreviewMaxLength } from "@/utils/validators/shared/messages";
import { hasPermissions } from "@/utils/hasPermissions";

type JSONIncompatibleMessageFields = Pick<
  MessageSerializable,
  "created_at" | "edited_at" | "id" | "channel_id" | "reply_to_message_id"
>;

type DeserializeMessage<T> = Omit<T, keyof JSONIncompatibleMessageFields> &
  Pick<Message, Extract<keyof T, keyof JSONIncompatibleMessageFields>>;

const deserializeMessage = <
  T extends object & Partial<JSONIncompatibleMessageFields>,
>(
  message: T
) =>
  ({
    ...message,
    ...(message.created_at ? { created_at: new Date(message.created_at) } : {}),
    ...(message.edited_at ? { edited_at: new Date(message.edited_at) } : {}),
    ...(message.id ? { id: BigInt(message.id) } : {}),
    ...(message.channel_id ? { channel_id: BigInt(message.channel_id) } : {}),
    ...(message.reply_to_message_id
      ? {
          reply_to_message_id: BigInt(message.reply_to_message_id),
        }
      : {}),
  }) as DeserializeMessage<T>;

const deserializeMessageData = <K extends WebsocketEventName>(
  payload: WebsocketEvents[K]
) =>
  ({
    message: {
      ...deserializeMessage(payload.message),
      parentMessage:
        "parentMessage" in payload.message && payload.message.parentMessage
          ? deserializeMessage(payload.message.parentMessage)
          : null,
    },
    messagesVersion: BigInt(payload.messagesVersion),
    parentMessageUpdate: payload.parentMessageUpdate
      ? deserializeMessage(payload.parentMessageUpdate)
      : null,
  }) as WebsocketEventsOriginal[K];

const BASE_INDEX = 1_000_000_000;
const PER_PAGE = 50;
const MAX_PAGES = 5;
const COMPACT_GAP_MS = minutes(5);
const MAX_GROUP_AGE_MS = minutes(20);
const MAX_GROUP_MESSAGES = 15;
const FETCH_MORE_THRESHOLD = 1;

const searchSchemaForm = z.object({
  text: Text.Long(),
});

type SearchFormValues = z.infer<typeof searchSchemaForm>;

const checkShouldCollapseMessage = (
  prevMessage: Message | RenderedMessage | undefined,
  message: Message | RenderedMessage
) => {
  return Boolean(
    prevMessage &&
      prevMessage.user_id === message.user_id &&
      !message.reply_to_message_id &&
      isWithinMs(message.created_at, prevMessage.created_at, COMPACT_GAP_MS)
  );
};

type MessagesGetInput = RouterInput["messages"]["get"];
type MessagesGetOutput = RouterOutput["messages"]["get"];
type MessagesCursor = MessagesGetInput["cursor"];
type MessagesError = TRPCClientErrorLike<AppRouter>;
type MessagesQueryKey = ReturnType<typeof getQueryKey>;
type MessagesSelectedData = InfiniteData<MessagesGetOutput, MessagesCursor> & {
  items: RenderedMessage[];
};

type MessagesInfiniteQueryOptionsInitial = UseInfiniteQueryOptions<
  MessagesGetOutput,
  MessagesError,
  MessagesSelectedData,
  MessagesQueryKey,
  MessagesCursor
>;

type MessagesInfiniteQueryOptions = Omit<
  MessagesInfiniteQueryOptionsInitial,
  | "queryKey"
  | "queryFn"
  | "initialPageParam"
  | "getPreviousPageParam"
  | "getNextPageParam"
  | "select"
>;
const messageQuerySelectors = {
  getPreviousPageParam: (firstPage, _, firstPageParam) => {
    if (firstPage.returnedDirection === "backward") {
      return firstPage.items.length >= PER_PAGE
        ? { id: firstPage.items[0].id, direction: "backward" }
        : undefined;
    } else {
      const firstPageParamId = firstPageParam?.id
        ? firstPageParam.id + BigInt(1)
        : null;
      const newCursorId = firstPage.items[0]?.id || firstPageParamId;
      return newCursorId
        ? { id: newCursorId, direction: "backward" }
        : undefined;
    }
  },
  getNextPageParam: (lastPage, _, lastPageParam) => {
    if (lastPage.isLatest) return undefined;
    if (lastPage.returnedDirection === "forward") {
      return lastPage.items.length >= PER_PAGE
        ? {
            id: lastPage.items[lastPage.items.length - 1].id,
            direction: "forward",
          }
        : undefined;
    } else {
      const lastPageParamId = lastPageParam?.id
        ? lastPageParam.id - BigInt(1)
        : null;
      const newCursorId =
        lastPage.items[lastPage.items.length - 1]?.id || lastPageParamId;
      return typeof newCursorId === "bigint" && newCursorId >= BigInt(0)
        ? { id: newCursorId, direction: "forward" }
        : undefined;
    }
  },
  select: (data) => {
    let items: (Message &
      Pick<RenderedMessage, "isCompact" | "isFirstMessageOfTheDay">)[] = [];

    // collapsing messages by the same user within a short period of time
    // while having sane limits on how many messages can be collapsed consecutively
    let groupStartCreatedAt: Date | undefined;
    let groupMessageCount = 0;
    for (let pageIndex = 0; pageIndex < data.pages.length; pageIndex++) {
      const page = data.pages[pageIndex];
      for (let itemIndex = 0; itemIndex < page.items.length; itemIndex++) {
        const prevPage = data.pages[pageIndex - 1];
        const prevMessage =
          itemIndex === 0 && prevPage
            ? prevPage.items[prevPage.items.length - 1]
            : page.items[itemIndex - 1];
        const message = page.items[itemIndex];

        const isFirstMessageOfTheDay =
          !prevMessage ||
          !isSameDay(message.created_at, prevMessage.created_at);

        const continuesPreviousGroup =
          !isFirstMessageOfTheDay &&
          !!prevMessage &&
          prevMessage.user_id === message.user_id &&
          !message.reply_to_message_id &&
          isWithinMs(
            message.created_at,
            prevMessage.created_at,
            COMPACT_GAP_MS
          ) &&
          !!groupStartCreatedAt &&
          isWithinMs(
            message.created_at,
            groupStartCreatedAt,
            MAX_GROUP_AGE_MS
          ) &&
          groupMessageCount < MAX_GROUP_MESSAGES;

        if (continuesPreviousGroup) {
          groupMessageCount += 1;
          items.push({ ...message, isCompact: true });
        } else {
          groupStartCreatedAt = message.created_at;
          groupMessageCount = 1;
          if (isFirstMessageOfTheDay) {
            items.push({ ...message, isFirstMessageOfTheDay: true });
          } else {
            items.push(message);
          }
        }
      }
    }

    return {
      ...data,
      items,
    };
  },
} satisfies Pick<
  MessagesInfiniteQueryOptionsInitial,
  "getPreviousPageParam" | "getNextPageParam" | "select"
>;

// doing all this to properly modify data before it hits cache
const useMessagesGet = (
  input: MessagesGetInput,
  options?: MessagesInfiniteQueryOptions
) => {
  const utils = trpc.useUtils();

  return useInfiniteQuery<
    MessagesGetOutput,
    MessagesError,
    MessagesSelectedData,
    MessagesQueryKey,
    MessagesCursor
  >({
    initialPageParam: input.cursor,
    ...options,
    ...messageQuerySelectors,
    queryKey: getQueryKey(trpc.messages.get, input, "infinite"),
    queryFn: async ({ pageParam, signal }) => {
      const page = await utils.client.messages.get.query(
        {
          ...input,
          cursor: pageParam,
        },
        { signal }
      );
      if (page.returnedDirection === "backward") {
        page.items.reverse();
      }
      return page;
    },
  });
};

const getLoadedMessagesIdBounds = (
  queryData: InfiniteData<MessagesGetOutput> | undefined
): { lowestId: bigint; highestId: bigint } | null => {
  const pagesCount = queryData?.pages.length;
  if (!pagesCount) return null;

  const firstNonEmptyPage = queryData.pages[0].items.length
    ? queryData.pages[0]
    : queryData.pages[1];
  const lastNonEmptyPage = queryData.pages[pagesCount - 1].items.length
    ? queryData.pages[pagesCount - 1]
    : queryData.pages[pagesCount - 2];

  const lowestId = firstNonEmptyPage.items[0]?.id;
  const highestId =
    lastNonEmptyPage?.items?.[lastNonEmptyPage?.items?.length - 1]?.id;

  if (!lowestId || !highestId) return null;

  return {
    lowestId,
    highestId,
  };
};

const baseIntervalMs = Number(seconds(5));
const maxIntervalMs = Number(seconds(30));

type SyncMode = "polling" | "ws-syncing" | "ws-live";

const syncModeMapping = {
  polling: {
    label: "refetching periodically",
    className: "bg-mui-warning-main",
  },
  "ws-syncing": {
    label: "syncing",
    className: "bg-mui-info-main",
  },
  "ws-live": {
    label: "live",
    className: "bg-mui-success-main",
  },
} as const satisfies Record<SyncMode, { label: string; className: string }>;

type Props = {
  channel: RouterOutput["channels"]["get"]["items"][number];
};

const MessageListOrchestrator = ({ channel }: Props) => {
  const globalModal = useGlobalModal();
  const { addAppSnackbar } = useAppSnackbar();

  const user = useUser();
  const authModal = useAuthModal();
  const qc = useQueryClient();
  const utils = trpc.useUtils();
  const router = useRouter();

  const channelIdString = String(channel.id);

  const messageCreateSchema = useMemo(
    () => makeMessageCreateSchemaForm(user.data?.user?.emailVerified),
    [user.data?.user?.emailVerified]
  );
  const form = useForm<MessageCreateFormValues>({
    defaultValues: { content: "", channelId: channel.id },
    resolver: zodResolver(messageCreateSchema),
  });

  const searchForm = useForm<SearchFormValues>({
    defaultValues: { text: "" },
    resolver: zodResolver(searchSchemaForm),
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerElRef = useRef<HTMLElement | null>(null);
  const visibleRangeRef = useRef<{
    visibleStartIndex: number;
    visibleEndIndex: number;
  } | null>(null);
  const hasQueryLoadedInitialData = useRef(false);
  const wasRefetching = useRef<boolean>(false);
  const userInteractedRef = useRef(false);

  const [messageToReply, setMessageToReply] = useState<
    (Pick<Message, "id"> & { author: Pick<User, "name"> }) | null
  >(null);
  const [isIdleTrigger, setIsIdleTrigger] = useState(0);
  const [isInitialScrollHandled, setIsInitialScrollHandled] =
    useState<boolean>(true);
  const [isMessageHighlightConsumed, setIsMessageHighlightConsumed] =
    useState<boolean>(false);
  const hasCompletedFirstInit = useRef<boolean>(false);
  const hasStartedWsSyncRefetch = useRef<boolean>(false);
  const nextOptimisticIdRef = useRef<bigint>(BigInt(-1));
  // gating initial load to avoid unnecessary refetch when waiting for websockets
  // in most cases it should be: ws connected -> start fetching initial page
  const [initialGateOpenedReason, setInitialGateOpenedReason] = useState<
    "default" | "websockets" | null
  >(null);
  const isInitialGateOpened = Boolean(initialGateOpenedReason);
  const initialTimerToOpenGateRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const isIdleRef = useRef<boolean>(false);
  const fetchMoreTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPreparingQuery, setIsPreparingQuery] = useState<boolean | null>(
    null
  ); // null for initial render before router is ready
  const [syncMode, setSyncMode] = useState<SyncMode>("polling");
  const [wsSyncFailedCount, setWsSyncFailedCount] = useState<number>(0);
  const [messagesQueryKey, setMessagesQueryKey] = useState<MessagesGetInput>({
    limit: PER_PAGE,
    channelId: channelIdString,
  });
  const isWsConnectedRef = useRef<boolean>(false);
  const isPolling = syncMode === "polling";
  const isWsSyncing = syncMode === "ws-syncing";
  const isWsLive = syncMode === "ws-live";

  const [optimisticMessages, setOptimisticMessages] = useState<
    RenderedMessage[]
  >([]);

  const refetchIntervalVars = useRef<{
    dataBefore:
      | Parameters<
          Extract<
            MessagesInfiniteQueryOptions["refetchInterval"],
            (...args: never[]) => unknown
          >
        >[0]["state"]["data"]
      | undefined;
    currentIntervalMs: number;
    wasFetching: boolean;
  }>({
    dataBefore: undefined,
    currentIntervalMs: baseIntervalMs,
    wasFetching: false,
  });

  const messages = useAppQuery(
    useMessagesGet(messagesQueryKey, {
      enabled: isPreparingQuery === false && isInitialGateOpened,
      refetchInterval(query) {
        const vars = refetchIntervalVars.current;
        if (query.state.error || !isPolling) {
          vars.wasFetching = false;
          vars.currentIntervalMs = baseIntervalMs;
          return false;
        }

        const isFetching = query.state.fetchStatus === "fetching";

        if (isFetching && !vars.wasFetching) vars.dataBefore = query.state.data;

        if (!isFetching && vars.wasFetching) {
          vars.currentIntervalMs =
            vars.dataBefore === query.state.data
              ? Math.min(maxIntervalMs, vars.currentIntervalMs + baseIntervalMs)
              : baseIntervalMs;
        }

        vars.wasFetching = isFetching;

        return vars.currentIntervalMs;
      },
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      gcTime: 0,
    })
  );

  const messagesVersion = useAppQuery(
    trpc.channels.getMessagesVersion.useQuery(
      { channelId: channelIdString },
      {
        enabled: isWsLive,
        staleTime: CACHE_TIME_MS.QUICK,
        refetchInterval: CACHE_TIME_MS.QUICK,
      }
    )
  );

  const appliedMessagesVersion = useRef<bigint>(BigInt(0));

  const handleNewMessagesVersion = (
    newVersion: bigint,
    isApplyingBufferedEvents?: boolean
  ) => {
    if (
      isApplyingBufferedEvents &&
      newVersion > appliedMessagesVersion.current
    ) {
      appliedMessagesVersion.current = newVersion;
      return true;
    }

    const expectedNewVersion = appliedMessagesVersion.current + BigInt(1);

    if (newVersion === expectedNewVersion) {
      appliedMessagesVersion.current = newVersion;
      return true;
    } else {
      if (newVersion > expectedNewVersion) {
        setSyncMode(isWsConnectedRef.current ? "ws-syncing" : "polling");
      }
      return false;
    }
  };

  const [firstItemIndex, setFirstItemIndex] = useState<number | null>(null);

  const totalItems = messages.data?.items.length || 0;

  const urlMessageId = useMemo(() => {
    const queryValue = getRouterQueryValue(router.query.messageId);
    if (numericIdQuerySchemaRaw.safeParse(queryValue).success) {
      return queryValue;
    } else {
      return undefined;
    }
  }, [router.query.messageId]);

  const foundMessageIndex = useMemo(() => {
    if (!urlMessageId || !messages.data?.items) return -1;
    const targetId = BigInt(urlMessageId);
    return messages.data.items.findIndex((m) => m.id === targetId);
  }, [messages.data?.items, urlMessageId]);

  const initialTopMostItemIndex = useMemo(() => {
    let result = -1;
    if (totalItems && firstItemIndex !== null) {
      result = foundMessageIndex >= 0 ? foundMessageIndex : totalItems - 1;
    }
    return result;
  }, [foundMessageIndex, totalItems, firstItemIndex]);

  const shouldRenderList =
    Boolean(totalItems) &&
    firstItemIndex !== null &&
    initialTopMostItemIndex !== -1;

  const websocketsMessageQueue = useRef<WebsocketItem[]>([]);

  const appendMessage = (
    data: WebsocketEventsOriginal["messages:create"],
    newMessagesVersion: bigint
  ) => {
    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      if (
        !queryData ||
        !queryData.pages.length ||
        (!data.parentMessageUpdate && messages.hasNextPage)
      ) {
        return queryData;
      }

      const message = data.message;
      let updatedPages = [...queryData.pages];
      let anythingChanged = false;

      if (data.parentMessageUpdate) {
        const idBounds = getLoadedMessagesIdBounds(queryData);
        const parentItemToUpdateId = data.parentMessageUpdate.id;
        if (
          idBounds &&
          parentItemToUpdateId >= idBounds.lowestId &&
          parentItemToUpdateId <= idBounds.highestId
        ) {
          for (let i = 0; i < updatedPages.length; i++) {
            const page = updatedPages[i];
            const foundItemIndex = page.items.findIndex(
              (m) => m.id === parentItemToUpdateId
            );
            if (foundItemIndex >= 0) {
              let updatedItems = [...page.items];
              updatedItems[foundItemIndex] = {
                ...updatedItems[foundItemIndex],
                reply_count: data.parentMessageUpdate.reply_count,
              };

              anythingChanged = true;
              updatedPages[i] = {
                ...updatedPages[i],
                items: updatedItems,
                messages_version: newMessagesVersion,
              };
            }
          }
        }
      }

      if (messages.hasNextPage) {
        return anythingChanged
          ? { ...queryData, pages: updatedPages }
          : queryData;
      }

      updatedPages[updatedPages.length - 1] = {
        ...updatedPages[updatedPages.length - 1],
        items: [...updatedPages[updatedPages.length - 1].items, message],
        messages_version: newMessagesVersion,
      };

      const shouldCreateNewPage =
        updatedPages[updatedPages.length - 1].items.length >= PER_PAGE;

      if (shouldCreateNewPage) {
        updatedPages.push({
          items: [],
          returnedDirection: "forward",
          messages_version: newMessagesVersion,
        });
        let updatedPageParams = [...queryData.pageParams];
        updatedPageParams.push({
          id: message.id,
          direction: "forward",
        });

        return {
          ...queryData,
          pages: updatedPages,
          pageParams: updatedPageParams,
        };
      }

      return { ...queryData, pages: updatedPages };
    });
  };

  const editMessage = (
    data: WebsocketEventsOriginal["messages:update"],
    newMessagesVersion: bigint
  ) => {
    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      const pagesCount = queryData?.pages.length;
      if (!queryData || !pagesCount) return queryData;
      const message = data.message;
      const itemToUpdateId = BigInt(message.id);
      let anythingChanged = false;
      let updatedPages = [...queryData.pages];

      for (let i = 0; i < updatedPages.length; i++) {
        const page = updatedPages[i];
        let replyMessagesToUpdateIndexes: number[] = [];
        let foundItemToUpdateIndex = -1;
        for (let j = 0; j < page.items.length; j++) {
          const item = page.items[j];

          if (item.id === itemToUpdateId) {
            foundItemToUpdateIndex = j;
          }
          if (item.reply_to_message_id === itemToUpdateId) {
            replyMessagesToUpdateIndexes.push(j);
          }
        }

        if (
          foundItemToUpdateIndex === -1 &&
          !replyMessagesToUpdateIndexes.length
        ) {
          continue;
        }

        let updatedItems = [...page.items];
        if (foundItemToUpdateIndex >= 0) {
          updatedItems[foundItemToUpdateIndex] = {
            ...updatedItems[foundItemToUpdateIndex],
            ...message,
          };
        }
        if (replyMessagesToUpdateIndexes.length) {
          replyMessagesToUpdateIndexes.forEach((index) => {
            updatedItems[index] = {
              ...updatedItems[index],
              parentMessage: updatedItems[index].parentMessage
                ? {
                    ...updatedItems[index].parentMessage,
                    edited_at: message.edited_at,
                    contentPreview: message.content.slice(
                      0,
                      messageContentPreviewMaxLength
                    ),
                  }
                : null,
            };
          });
        }

        anythingChanged = true;
        updatedPages[i] = {
          ...updatedPages[i],
          items: updatedItems,
          messages_version: newMessagesVersion,
        };
      }
      return anythingChanged
        ? { ...queryData, pages: updatedPages }
        : queryData;
    });
  };

  const deleteMessage = (
    data: WebsocketEventsOriginal["messages:delete"],
    newMessagesVersion: bigint
  ) => {
    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      const pagesCount = queryData?.pages.length;
      if (!queryData || !pagesCount) return queryData;
      const itemToDeleteId = data.message.id;
      const parentItemToUpdateId = data.parentMessageUpdate?.id;
      let anythingChanged = false;

      let updatedPages = [...queryData.pages];
      let updatedPageParams = [...queryData.pageParams];
      let targetMessageGlobalIndex = firstItemIndex || 0;
      let foundItemToDeletePageIndex = -1;
      let foundItemToDeleteIndex = -1;
      for (let i = 0; i < updatedPages.length; i++) {
        const page = updatedPages[i];
        let foundParentItemToUpdateIndex = -1;
        let replyMessagesToUpdateIndexes: number[] = [];

        for (let j = 0; j < page.items.length; j++) {
          const item = page.items[j];

          if (item.id === itemToDeleteId) {
            foundItemToDeletePageIndex = i;
            foundItemToDeleteIndex = j;
          }
          if (parentItemToUpdateId && item.id === parentItemToUpdateId) {
            foundParentItemToUpdateIndex = j;
          }
          if (item.reply_to_message_id === itemToDeleteId) {
            replyMessagesToUpdateIndexes.push(j);
          }
        }

        if (foundItemToDeleteIndex === -1) {
          targetMessageGlobalIndex += page.items.length;
        }

        if (
          foundParentItemToUpdateIndex === -1 &&
          !replyMessagesToUpdateIndexes.length
        ) {
          continue;
        }

        let updatedItems = [...page.items];
        if (data.parentMessageUpdate && foundParentItemToUpdateIndex >= 0) {
          updatedItems[foundParentItemToUpdateIndex] = {
            ...updatedItems[foundParentItemToUpdateIndex],
            reply_count: data.parentMessageUpdate.reply_count,
          };
        }

        if (replyMessagesToUpdateIndexes.length) {
          replyMessagesToUpdateIndexes.forEach((index) => {
            updatedItems[index] = {
              ...updatedItems[index],
              parentMessage: null,
            };
          });
        }

        anythingChanged = true;
        updatedPages[i] = {
          ...updatedPages[i],
          items: updatedItems,
          messages_version: newMessagesVersion,
        };
      }
      if (foundItemToDeleteIndex >= 0 && foundItemToDeletePageIndex >= 0) {
        targetMessageGlobalIndex += foundItemToDeleteIndex;
        const visibleGlobalStartIndex =
          visibleRangeRef.current?.visibleStartIndex || 0;
        const isTargetMessageAboveViewport =
          targetMessageGlobalIndex < visibleGlobalStartIndex;

        let updatedItems = [...updatedPages[foundItemToDeletePageIndex].items];

        anythingChanged = true;
        updatedItems.splice(foundItemToDeleteIndex, 1);
        updatedPages[foundItemToDeletePageIndex] = {
          ...updatedPages[foundItemToDeletePageIndex],
          items: updatedItems,
          messages_version: newMessagesVersion,
        };

        if (
          !updatedItems.length &&
          foundItemToDeletePageIndex !== updatedPages.length - 1
        ) {
          updatedPages.splice(foundItemToDeletePageIndex, 1);
          updatedPageParams.splice(foundItemToDeletePageIndex, 1);
        }
        if (isTargetMessageAboveViewport) {
          setFirstItemIndex((prev) => (prev !== null ? prev + 1 : prev));
        }
      }
      return anythingChanged
        ? {
            ...queryData,
            pages: updatedPages,
            pageParams: updatedPageParams,
          }
        : queryData;
    });
  };

  const dependencies = useRef({
    messagesQueryKey,
    firstItemIndex,
    messages,
    isPolling,
    isWsSyncing,
    handleNewMessagesVersion,
    utils,
    initialGateOpenedReason,
    isIdleTrigger,
    appendMessage,
    editMessage,
    deleteMessage,
  });

  dependencies.current = {
    messagesQueryKey,
    firstItemIndex,
    messages,
    isPolling,
    isWsSyncing,
    handleNewMessagesVersion,
    utils,
    initialGateOpenedReason,
    isIdleTrigger,
    appendMessage,
    editMessage,
    deleteMessage,
  };

  const wsMessageCreateHandler = useCallback(
    (
      data: WebsocketPayload<"messages:create">,
      isApplyingBufferedEvents?: boolean
    ) => {
      const {
        isPolling,
        isWsSyncing,
        messages,
        handleNewMessagesVersion,
        appendMessage,
      } = dependencies.current;
      const message = data.message;
      const newMessagesVersion = BigInt(data.messagesVersion);
      if (isPolling) return;
      if (isWsSyncing && !isApplyingBufferedEvents) {
        websocketsMessageQueue.current.push({
          eventName: "messages:create",
          data,
        });
        return;
      }
      if (
        !handleNewMessagesVersion(newMessagesVersion, isApplyingBufferedEvents)
      ) {
        return;
      }

      if (isApplyingBufferedEvents) {
        const newMessageAlreadyExists = messages.data?.items.some(
          (item) => item.id === BigInt(message.id)
        );
        if (newMessageAlreadyExists) {
          return;
        }
      }

      appendMessage(
        deserializeMessageData<"messages:create">(data),
        newMessagesVersion
      );
    },
    []
  );

  const wsMessageUpdateHandler = useCallback(
    (
      data: WebsocketEvents["messages:update"],
      isApplyingBufferedEvents?: boolean
    ) => {
      const { isWsSyncing, isPolling, handleNewMessagesVersion, editMessage } =
        dependencies.current;
      const newMessagesVersion = BigInt(data.messagesVersion);
      if (isPolling) return;
      if (isWsSyncing && !isApplyingBufferedEvents) {
        websocketsMessageQueue.current.push({
          eventName: "messages:update",
          data,
        });
        return;
      }
      if (
        !handleNewMessagesVersion(newMessagesVersion, isApplyingBufferedEvents)
      ) {
        return;
      }
      editMessage(
        deserializeMessageData<"messages:update">(data),
        newMessagesVersion
      );
    },
    []
  );

  const wsMessageDeleteHandler = useCallback(
    (
      data: WebsocketPayload<"messages:delete">,
      isApplyingBufferedEvents?: boolean
    ) => {
      const {
        isWsSyncing,
        isPolling,
        handleNewMessagesVersion,
        deleteMessage,
      } = dependencies.current;
      const newMessagesVersion = BigInt(data.messagesVersion);
      if (isPolling) return;
      if (isWsSyncing && !isApplyingBufferedEvents) {
        websocketsMessageQueue.current.push({
          eventName: "messages:delete",
          data,
        });
        return;
      }
      if (
        !handleNewMessagesVersion(newMessagesVersion, isApplyingBufferedEvents)
      ) {
        return;
      }

      deleteMessage(
        deserializeMessageData<"messages:delete">(data),
        newMessagesVersion
      );
    },
    []
  );

  const deleteOptimisticMessage = (id: bigint) => {
    setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const onOwnMessageActionSuccess = () => {
    if (isPolling) {
      refetchIntervalVars.current.currentIntervalMs = baseIntervalMs;
      utils.messages.get.invalidate();
    }
  };

  const messagesCreateSpamMutation = trpc.messages.createSpam.useMutation({
    onSuccess: () => {
      utils.messages.get.invalidate();
    },
  });

  const messageCreateMutation = trpc.messages.create.useMutation({
    onMutate(variables) {
      const currentUser = user.data?.user;
      if (!currentUser) return;
      const tempId = nextOptimisticIdRef.current;
      nextOptimisticIdRef.current -= BigInt(1);
      setOptimisticMessages((prev) => [
        ...prev,
        {
          channel_id: variables.channelId,
          content: variables.content,
          created_at: new Date(),
          edited_at: new Date(),
          deleted_at: null,
          id: tempId,
          user_id: currentUser.id,
          reply_count: 0,
          reply_to_message_id: variables.reply_to_message_id || null,
          author: {
            ...currentUser,
          },
          isOptimistic: true,
          parentMessage: null,
        },
      ]);
      return {
        tempId,
      };
    },
    onSuccess(data, _vars, onMutateResult) {
      if (onMutateResult?.tempId) {
        deleteOptimisticMessage(onMutateResult.tempId);
      }
      if (handleNewMessagesVersion(data.messagesVersion)) {
        appendMessage(data, appliedMessagesVersion.current);
      }
      onOwnMessageActionSuccess();
    },
    onError(_error, _variables, onMutateResult) {
      if (onMutateResult?.tempId) {
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m.id === onMutateResult.tempId ? { ...m, isFailed: true } : m
          )
        );
      }
    },
    meta: { keepDefaultErrorHandling: true },
  });

  // const commentDeleteAllMutation = trpc.messages.deleteAll.useMutation({
  //   onSuccess: () => {
  //     utils.messages.get.invalidate();
  //   },
  // });

  const guestLoginMutation = trpc.auth.loginAnonymous.useMutation({
    onSuccess() {
      userLoginLifecycle(qc);
    },
  });

  const onGuestClick = () => {
    guestLoginMutation.mutate();
  };

  const setUrlMessageId = (id?: string) => {
    let nextQuery = { ...router.query };
    if (id) {
      nextQuery.messageId = id;
    } else {
      delete nextQuery.messageId;
    }
    router.push({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
    });
  };

  const onSubmit: SubmitHandler<MessageCreateFormValues> = (values) => {
    form.reset();
    messageCreateMutation.mutate({
      ...values,
      reply_to_message_id: messageToReply?.id,
    });
    setMessageToReply(null);
  };
  const onSearchSubmit: SubmitHandler<SearchFormValues> = (values) => {
    setUrlMessageId(values.text);
  };

  const authDisabled = guestLoginMutation.isPending || user.isFetching;

  // console.log({
  //   appliedMessagesVersion: appliedMessagesVersion.current,
  // });

  const tryLoadOlder = async (bypassExistingError?: boolean) => {
    if (!bypassExistingError && messages.isFetchPreviousPageError) {
      return;
    }

    const res = await messages.fetchPreviousPage({ cancelRefetch: false });
    if (res.isFetchPreviousPageError) return;

    const newPage = res.data?.pages?.[0];
    const prependedCount = newPage?.items.length || 0;
    if (prependedCount) {
      setFirstItemIndex((prev) =>
        prev !== null ? prev - prependedCount : prev
      );
    }

    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      let data = queryData;
      if (!data) return data;

      const totalPages = data.pages.length;
      if (!totalPages || totalPages <= MAX_PAGES || !isPolling) {
        return data;
      }

      const cutoff = MAX_PAGES;
      return {
        ...data,
        pageParams: data.pageParams.slice(0, cutoff),
        pages: data.pages.slice(0, cutoff),
      };
    });
  };

  console.log(
    { ...messages },
    {
      syncMode,
      isIdleRef: isIdleRef.current,
      initialGateOpenedReason,
      wsSyncFailedCount,
      hasQueryLoadedInitialData: hasQueryLoadedInitialData.current,
      isWsConnectedRef: isWsConnectedRef.current,
      websocketsMessageQueue: websocketsMessageQueue.current,
      appliedMessagesVersion: appliedMessagesVersion.current,
    }
  );

  const tryLoadNewer = async (bypassExistingError?: boolean) => {
    if (!bypassExistingError && messages.isFetchNextPageError) {
      return;
    }

    const res = await messages.fetchNextPage({ cancelRefetch: false });
    if (res.isFetchNextPageError) return;

    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      let data = queryData;
      if (!data) return data;

      const totalPages = data.pages.length;
      if (!totalPages || totalPages <= MAX_PAGES || !isPolling) {
        return data;
      }

      const cutoff = totalPages - MAX_PAGES;
      const pagesToRemove = data.pages.slice(0, cutoff);
      const itemsCountToRemoveFromTop = pagesToRemove.reduce(
        (total, curr) => total + curr.items.length,
        0
      );
      setFirstItemIndex((prev) =>
        prev !== null ? prev + itemsCountToRemoveFromTop : prev
      );
      return {
        ...data,
        pageParams: data.pageParams.slice(cutoff),
        pages: data.pages.slice(cutoff),
      };
    });
  };

  const repairEmptyPageParams = () => {
    utils.messages.get.setInfiniteData(messagesQueryKey, (data) => {
      if (!data?.pageParams.length || !data.pages.length) return data;
      let updatedPageParams = [...data.pageParams];

      for (let i = 0; i < updatedPageParams.length; i++) {
        if (updatedPageParams[i]) continue;

        const nextPage = data.pages[i + 1];
        const prevPage = data.pages[i - 1];
        const nextPageFirstItemId = nextPage?.items[0]?.id;
        const prevPageLastItemId =
          prevPage?.items[prevPage?.items.length - 1]?.id;
        const currentPageFirstItemId = data.pages[i]?.items?.[0]?.id;

        if (nextPageFirstItemId) {
          updatedPageParams[i] = {
            ...updatedPageParams[i],
            id: nextPageFirstItemId,
            direction: "backward",
          };
        } else if (prevPageLastItemId) {
          updatedPageParams[i] = {
            ...updatedPageParams[i],
            id: prevPageLastItemId,
            direction: "forward",
          };
        } else if (currentPageFirstItemId) {
          const newId = currentPageFirstItemId - BigInt(1);
          updatedPageParams[i] = {
            ...updatedPageParams[i],
            id: newId < BigInt(1) ? BigInt(0) : newId,
            direction: "forward",
          };
        }
      }

      return { ...data, pageParams: updatedPageParams };
    });
  };

  const trimPagesAroundViewport = () => {
    const totalPages = messages.data?.pages.length;
    if (
      messages.data &&
      visibleRangeRef.current &&
      firstItemIndex !== null &&
      totalPages &&
      totalPages > MAX_PAGES
    ) {
      const visibleStartIndex =
        visibleRangeRef.current.visibleStartIndex - firstItemIndex;
      const visibleEndIndex =
        visibleRangeRef.current.visibleEndIndex - firstItemIndex;

      if (visibleStartIndex < 0 || visibleEndIndex < 0) {
        return;
      }

      let visibleStartIndexBelongsToPageIndex = null;
      let visibleEndIndexBelongsToPageIndex = null;
      const pages = messages.data.pages;
      let currentPageGlobalStartIndex = -1;
      let currentPageGlobalEndIndex = -1;
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];

        currentPageGlobalStartIndex = currentPageGlobalEndIndex + 1;
        currentPageGlobalEndIndex =
          currentPageGlobalStartIndex + (page.items.length - 1);

        if (
          visibleStartIndexBelongsToPageIndex !== null &&
          visibleEndIndexBelongsToPageIndex !== null
        ) {
          break;
        }

        if (
          visibleStartIndexBelongsToPageIndex === null &&
          currentPageGlobalStartIndex <= visibleStartIndex &&
          visibleStartIndex <= currentPageGlobalEndIndex
        ) {
          visibleStartIndexBelongsToPageIndex = i;
        }
        if (
          visibleEndIndexBelongsToPageIndex === null &&
          currentPageGlobalStartIndex <= visibleEndIndex &&
          visibleEndIndex <= currentPageGlobalEndIndex
        ) {
          visibleEndIndexBelongsToPageIndex = i;
        }
      }

      if (
        visibleStartIndexBelongsToPageIndex === null ||
        visibleEndIndexBelongsToPageIndex === null
      ) {
        return;
      }

      const pageIndexDiff =
        visibleEndIndexBelongsToPageIndex - visibleStartIndexBelongsToPageIndex;
      if (pageIndexDiff < 0 || pageIndexDiff > MAX_PAGES - 2) {
        return;
      }

      let lowestPageIndex = visibleStartIndexBelongsToPageIndex;
      let highestPageIndex = visibleEndIndexBelongsToPageIndex;
      let includedPageIndexes = new Set();
      for (let i = lowestPageIndex; i <= highestPageIndex; i++) {
        // these pages must be included
        includedPageIndexes.add(i);
      }
      while (includedPageIndexes.size < MAX_PAGES) {
        const newLowestPageIndex = lowestPageIndex - 1;
        if (newLowestPageIndex >= 0) {
          lowestPageIndex = newLowestPageIndex;
          includedPageIndexes.add(lowestPageIndex);
        }

        if (includedPageIndexes.size >= MAX_PAGES) break;

        const newHighestPageIndex = highestPageIndex + 1;
        if (newHighestPageIndex < pages.length) {
          highestPageIndex = newHighestPageIndex;
          includedPageIndexes.add(highestPageIndex);
        }

        if (
          newLowestPageIndex === 0 &&
          newHighestPageIndex === pages.length - 1
        ) {
          break;
        }
      }

      utils.messages.get.setInfiniteData(messagesQueryKey, (data) => {
        if (!data) return data;
        const pagesToRemoveFromTop = pages.slice(0, lowestPageIndex);
        const itemsCountToRemoveFromTop = pagesToRemoveFromTop.reduce(
          (total, curr) => total + curr.items.length,
          0
        );
        setFirstItemIndex((prev) =>
          prev !== null ? prev + itemsCountToRemoveFromTop : prev
        );
        return {
          ...data,
          pageParams: data.pageParams.slice(
            lowestPageIndex,
            highestPageIndex + 1
          ),
          pages: data.pages.slice(lowestPageIndex, highestPageIndex + 1),
        };
      });
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

  useEffect(() => {
    const onNavigation = (newPath: string) => {
      const currentPath = router.asPath;
      if (currentPath === newPath) {
        resetMessagesList();
      }
    };
    router.events.on("routeChangeStart", onNavigation);
    return () => {
      router.events.off("routeChangeStart", onNavigation);
    };
    // eslint-disable-next-line
  }, [router.events, router.asPath]);

  useEffect(() => {
    return () => {
      debouncedMakeIdle.cancel();
    };
  }, [debouncedMakeIdle]);

  useEffect(() => {
    if (!totalItems) {
      setFirstItemIndex(null);
      return;
    }

    if (firstItemIndex === null) {
      setFirstItemIndex(BASE_INDEX - totalItems);
      return;
    }
    // eslint-disable-next-line
  }, [totalItems]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const markInteracted = () => {
      userInteractedRef.current = true;
    };

    el.addEventListener("wheel", markInteracted, { passive: true });
    el.addEventListener("touchstart", markInteracted, { passive: true });
    el.addEventListener("pointerdown", markInteracted, { passive: true });
    el.addEventListener("touchmove", markInteracted, { passive: true });
    el.addEventListener("keydown", markInteracted);

    return () => {
      el.removeEventListener("wheel", markInteracted);
      el.removeEventListener("touchstart", markInteracted);
      el.removeEventListener("pointerdown", markInteracted);
      el.removeEventListener("touchmove", markInteracted);
      el.removeEventListener("keydown", markInteracted);
    };
  }, []);

  const clearInitialTimerToOpenGate = () => {
    if (initialTimerToOpenGateRef.current) {
      clearTimeout(initialTimerToOpenGateRef.current);
    }
    initialTimerToOpenGateRef.current = null;
  };

  const websocketsClient = useWsClient();

  const trySwitchToLiveWebsockets = ({
    lowestMessagesVersion,
    highestMessagesVersion,
  }: {
    lowestMessagesVersion: bigint;
    highestMessagesVersion: bigint;
  }) => {
    if (!isWsSyncing) return;

    const relevantEvents = websocketsMessageQueue.current
      .filter((e) => BigInt(e.data.messagesVersion) > lowestMessagesVersion)
      .sort((aEvent, bEvent) => {
        const a = BigInt(aEvent.data.messagesVersion);
        const b = BigInt(bEvent.data.messagesVersion);
        return a < b ? -1 : a > b ? 1 : 0;
      });

    const canSafelySwitchToWebsockets = relevantEvents.length
      ? (() => {
          const minVersion = BigInt(relevantEvents[0].data.messagesVersion);
          const maxVersion = BigInt(
            relevantEvents[relevantEvents.length - 1].data.messagesVersion
          );

          return (
            maxVersion >= highestMessagesVersion &&
            minVersion === lowestMessagesVersion + BigInt(1) &&
            maxVersion - minVersion + BigInt(1) ===
              BigInt(relevantEvents.length)
          );
        })()
      : lowestMessagesVersion === highestMessagesVersion;

    if (!canSafelySwitchToWebsockets) {
      setWsSyncFailedCount((prev) => prev + 1);
      addAppSnackbar({
        message: "Realtime sync failed.",
        variant: "warning",
      });
      return;
    }

    relevantEvents.forEach((event) => {
      switch (event.eventName) {
        case "messages:create": {
          wsMessageCreateHandler(event.data, true);
          break;
        }
        case "messages:update": {
          wsMessageUpdateHandler(event.data, true);
          break;
        }
        case "messages:delete": {
          wsMessageDeleteHandler(event.data, true);
          break;
        }
        default: {
          break;
        }
      }
    });

    hasStartedWsSyncRefetch.current = false;
    websocketsMessageQueue.current = [];
    setWsSyncFailedCount(0);
    setSyncMode("ws-live");
  };

  useEffect(() => {
    if (!websocketsClient) return;

    let isEffectCleanup = false;
    const websocketsChannel = websocketsClient.channels.get(
      getChannelId(channelIdString)
    );
    const onConnectionLost = () => {
      if (isEffectCleanup) return;
      const { isPolling } = dependencies.current;
      isWsConnectedRef.current = false;
      if (!isPolling) {
        setSyncMode("polling");
        setInitialGateOpenedReason("default");
        addAppSnackbar({
          message:
            "Realtime connection lost. Falling back to periodic refetch.",
          variant: "warning",
        });
      }
    };

    const onChannelUpdate = (state: { resumed?: boolean }) => {
      if (isEffectCleanup) return;
      if (state.resumed === false) {
        onConnectionLost();
      }
    };

    const tryStartSyncing = () => {
      if (isEffectCleanup) return;
      const isWsConnected = websocketsClient.connection.state === "connected";
      const isWsChannelAttached = websocketsChannel.state === "attached";
      const { initialGateOpenedReason } = dependencies.current;
      if (isWsConnected && isWsChannelAttached) {
        isWsConnectedRef.current = true;
        websocketsMessageQueue.current = [];
        clearInitialTimerToOpenGate();
        setWsSyncFailedCount(0);
        setSyncMode("ws-syncing");
        setInitialGateOpenedReason(
          initialGateOpenedReason ? "default" : "websockets"
        );
      }
    };

    websocketsClient.connection.on(
      ["disconnected", "suspended", "failed"],
      onConnectionLost
    );
    websocketsChannel.on(["suspended", "failed"], onConnectionLost);
    websocketsChannel.on("update", onChannelUpdate);

    websocketsClient.connection.on("connected", tryStartSyncing);
    websocketsChannel.on("attached", tryStartSyncing);

    const unsubs = [
      subscribeWs(websocketsChannel, "messages:create", (data) => {
        wsMessageCreateHandler(data);
      }),
      subscribeWs(websocketsChannel, "messages:update", (data) => {
        wsMessageUpdateHandler(data);
      }),
      subscribeWs(websocketsChannel, "messages:delete", (data) => {
        wsMessageDeleteHandler(data);
      }),
    ];

    return () => {
      isEffectCleanup = true;
      unsubs.forEach((u) => u());

      websocketsClient.connection.off(onConnectionLost);
      websocketsClient.connection.off(tryStartSyncing);
      websocketsChannel.off(onConnectionLost);
      websocketsChannel.off(onChannelUpdate);
      websocketsChannel.off(tryStartSyncing);

      void websocketsChannel.detach();
    };
    // eslint-disable-next-line
  }, [websocketsClient, channelIdString]);

  useLayoutEffect(() => {
    if (isWsSyncing) {
      hasStartedWsSyncRefetch.current = false;
    }
  }, [isWsSyncing]);

  const shouldStartWsSyncRefetch =
    isWsSyncing &&
    !messages.isFetching &&
    (!shouldRenderList || isIdleRef.current) &&
    initialGateOpenedReason === "default" &&
    !hasStartedWsSyncRefetch.current;

  useEffect(() => {
    if (shouldStartWsSyncRefetch) {
      hasStartedWsSyncRefetch.current = true;
      messages.refetch();
    }
    // eslint-disable-next-line
  }, [shouldStartWsSyncRefetch]);

  useEffect(() => {
    const data = messages.data;
    if (!data?.pages.length) return;

    if (!hasQueryLoadedInitialData.current) {
      hasQueryLoadedInitialData.current = true;
      const messagesVersion = data.pages[0].messages_version;
      appliedMessagesVersion.current = messagesVersion;
      if (initialGateOpenedReason === "websockets") {
        trySwitchToLiveWebsockets({
          lowestMessagesVersion: messagesVersion,
          highestMessagesVersion: messagesVersion,
        });
      }
      repairEmptyPageParams();
    }
    // eslint-disable-next-line
  }, [messages.dataUpdatedAt]);

  useEffect(() => {
    const data = messages.data;
    if (!data?.pages.length) return;

    const prevWasRefetching = wasRefetching.current;
    wasRefetching.current = messages.isRefetching;

    if (prevWasRefetching && !messages.isRefetching) {
      if (messages.isRefetchError) {
        setSyncMode("polling");
        setInitialGateOpenedReason("default");
        return;
      }

      const lowestRefetchedMessagesVersion = data.pages[0].messages_version;
      const highestRefetchedMessagesVersion =
        data.pages[data.pages.length - 1].messages_version;
      appliedMessagesVersion.current = isWsSyncing
        ? lowestRefetchedMessagesVersion
        : highestRefetchedMessagesVersion;

      trySwitchToLiveWebsockets({
        lowestMessagesVersion: lowestRefetchedMessagesVersion,
        highestMessagesVersion: highestRefetchedMessagesVersion,
      });
    }
    // eslint-disable-next-line
  }, [messages.isRefetching]);

  useEffect(() => {
    if (wsSyncFailedCount > 0) {
      setSyncMode("polling");
      setInitialGateOpenedReason("default");
    }
  }, [wsSyncFailedCount]);

  useEffect(() => {
    if (isPolling) {
      repairEmptyPageParams();
      trimPagesAroundViewport();
      if (wsSyncFailedCount < 3 && isWsConnectedRef.current) {
        websocketsMessageQueue.current = [];
        setSyncMode("ws-syncing");
      }
    }
    // eslint-disable-next-line
  }, [isPolling]);

  useEffect(() => {
    // periodic check by channel version to ensure latest data
    if (
      messagesVersion.isSuccess &&
      !messagesVersion.isRefetching &&
      !messagesVersion.isRefetchError &&
      isWsLive &&
      messagesVersion.data > appliedMessagesVersion.current
    ) {
      websocketsMessageQueue.current = [];
      setWsSyncFailedCount(0);
      setSyncMode("ws-syncing");
    }
    // eslint-disable-next-line
  }, [messagesVersion.isRefetching]);

  const resetMessagesList = () => {
    refetchIntervalVars.current.wasFetching = false;
    refetchIntervalVars.current.currentIntervalMs = baseIntervalMs;
    hasQueryLoadedInitialData.current = false;
    wasRefetching.current = false;
    userInteractedRef.current = false;
    websocketsMessageQueue.current = [];
    hasStartedWsSyncRefetch.current = false;
    clearInitialTimerToOpenGate();
    setWsSyncFailedCount(0);
    setIsPreparingQuery(true);
    setIsInitialScrollHandled(false);
    setIsMessageHighlightConsumed(false);

    if (foundMessageIndex === -1) {
      if (isWsConnectedRef.current) {
        setSyncMode("ws-syncing");
        setInitialGateOpenedReason("websockets");
      } else {
        setSyncMode("polling");
        if (hasCompletedFirstInit.current) {
          setInitialGateOpenedReason("default");
        } else {
          setInitialGateOpenedReason(null);
          initialTimerToOpenGateRef.current = setTimeout(() => {
            setInitialGateOpenedReason("default");
            initialTimerToOpenGateRef.current = null;
          }, 1000);
        }
      }
    }

    if (!hasCompletedFirstInit.current) {
      hasCompletedFirstInit.current = true;
    }
  };

  const retryInvalidate = () => {
    if (!messages.isError || messages.isFetching) {
      return;
    }

    if (urlMessageId) {
      setUrlMessageId();
    } else {
      resetMessagesList();
    }
  };

  useEffect(() => {
    if (!router.isReady) return;

    resetMessagesList();
    // eslint-disable-next-line
  }, [urlMessageId]);

  useEffect(() => {
    if (!isPreparingQuery) return;

    if (foundMessageIndex === -1) {
      qc.removeQueries({
        queryKey: getQueryKey(trpc.messages.get, messagesQueryKey, "infinite"),
        exact: true,
      });
      setMessagesQueryKey((prev) => ({
        ...prev,
        around: urlMessageId || undefined,
      }));
    }

    setIsPreparingQuery(false);

    // eslint-disable-next-line
  }, [isPreparingQuery]);

  useEffect(() => {
    if (
      isPreparingQuery !== false ||
      isInitialScrollHandled ||
      !messages.data?.items.length ||
      !isIdleRef.current
    ) {
      return;
    }
    if (urlMessageId) {
      if (foundMessageIndex === -1) {
        addAppSnackbar({
          message: `Message with ID ${urlMessageId} not found.`,
          variant: "error",
        });
      } else {
        virtuosoRef.current?.scrollToIndex({
          index: foundMessageIndex,
          align: "center",
          behavior: "auto",
        });
      }
      setIsInitialScrollHandled(true);
    } else if (!userInteractedRef.current) {
      if (!messages.hasNextPage) {
        virtuosoRef.current?.scrollToIndex({
          index: initialTopMostItemIndex,
          align: "end",
          behavior: "auto",
        });

        setIsInitialScrollHandled(true);
      }
    } else {
      setIsInitialScrollHandled(true);
    }

    // eslint-disable-next-line
  }, [
    isInitialScrollHandled,
    messages.hasNextPage,
    messages.data?.items,
    isPreparingQuery,
    isIdleTrigger,
  ]);

  const clearFetchMoreTimeout = () => {
    if (fetchMoreTimeout.current) {
      clearTimeout(fetchMoreTimeout.current);
    }
  };

  useEffect(() => {
    if (
      !messages.hasPreviousPage ||
      firstItemIndex === null ||
      !visibleRangeRef.current
    ) {
      return;
    }

    const localVisibleStartIndex = Math.max(
      0,
      visibleRangeRef.current?.visibleStartIndex - firstItemIndex
    );

    if (
      isIdleRef.current &&
      localVisibleStartIndex <= FETCH_MORE_THRESHOLD &&
      !isWsSyncing &&
      messages.hasPreviousPage &&
      !messages.isFetching &&
      !messages.isError
    ) {
      clearFetchMoreTimeout();
      fetchMoreTimeout.current = setTimeout(() => {
        tryLoadOlder();
      }, 50);
    }
    return clearFetchMoreTimeout;
    // eslint-disable-next-line
  }, [
    isIdleTrigger,
    isWsSyncing,
    totalItems,
    messages.isFetching,
    messages.isError,
    messages.hasPreviousPage,
  ]);

  useEffect(() => {
    if (
      !messages.hasNextPage ||
      firstItemIndex === null ||
      !visibleRangeRef.current
    ) {
      return;
    }

    const localVisibleEndIndex = Math.max(
      0,
      visibleRangeRef.current?.visibleEndIndex - firstItemIndex
    );

    if (
      isIdleRef.current &&
      localVisibleEndIndex >= totalItems - 1 - FETCH_MORE_THRESHOLD &&
      !isWsSyncing &&
      messages.hasNextPage &&
      !messages.isFetching &&
      !messages.isError
    ) {
      clearFetchMoreTimeout();
      fetchMoreTimeout.current = setTimeout(() => {
        tryLoadNewer();
      }, 50);
    }
    return clearFetchMoreTimeout;
    // eslint-disable-next-line
  }, [
    isIdleTrigger,
    isWsSyncing,
    totalItems,
    messages.isFetching,
    messages.isError,
    messages.hasNextPage,
  ]);

  const virtuosoContext = {
    messages,
    scrollerElRef,
    retryInvalidate,
    tryLoadOlder,
    tryLoadNewer,
    isIdleTrigger,
    isWsSyncing,
    channel,
  };

  const MessagesHeader = useMemo(
    () =>
      ({ context }: { context: typeof virtuosoContext }) => {
        const { messages, tryLoadOlder, channel } = context;

        if (messages.isFetchPreviousPageError) {
          return (
            <VerticalStack withPadding addClassName="items-center">
              <Typography color="warning" variant="body2">
                Failed to load older messages
              </Typography>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<ReplayIcon />}
                onClick={() => tryLoadOlder(true)}
                isLoading={messages.isFetchingPreviousPage}
                size="large"
                className="w-fit"
              >
                Retry
              </Button>
            </VerticalStack>
          );
        }
        if (messages.hasPreviousPage) {
          return <MessagesSkeleton />;
        }
        return <ChannelHeader channel={channel} isInsideVirtuoso />;
      },
    []
  );
  const MessagesFooter = useMemo(
    () =>
      ({ context }: { context: typeof virtuosoContext }) => {
        const { messages, retryInvalidate, tryLoadNewer } = context;
        if (messages.isFetchNextPageError) {
          return (
            <VerticalStack withPadding addClassName="items-center">
              <Typography color="warning" variant="body2">
                Failed to load newer messages
              </Typography>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<ReplayIcon />}
                onClick={() => tryLoadNewer(true)}
                isLoading={messages.isFetchingNextPage}
                size="large"
                className="w-fit"
              >
                Retry
              </Button>
            </VerticalStack>
          );
        }
        if (
          !messages.isFetchNextPageError &&
          !messages.isFetchPreviousPageError &&
          messages.isError
        ) {
          return (
            <VerticalStack withPadding addClassName="items-center">
              <Typography color="warning" variant="body2">
                Failed to load messages
              </Typography>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<ReplayIcon />}
                onClick={retryInvalidate}
                size="large"
                className="w-fit"
              >
                Retry
              </Button>
            </VerticalStack>
          );
        }
        if (messages.hasNextPage) {
          return <MessagesSkeleton />;
        }

        return <div className="p-2"></div>;
      },
    []
  );

  const MessagesComponents = useMemo(
    () => ({
      Header: MessagesHeader,
      Footer: MessagesFooter,
    }),
    // eslint-disable-next-line
    []
  );

  const renderedMessages = useMemo<
    typeof optimisticMessages | undefined
  >(() => {
    if (optimisticMessages.length && messages.data?.items) {
      let resultOptimisticMessages: typeof optimisticMessages = [];
      for (let i = 0; i < optimisticMessages.length; i++) {
        const prevMessage =
          i === 0
            ? messages.data.items[messages.data.items.length - 1]
            : optimisticMessages[i - 1];
        const message = optimisticMessages[i];
        const isCompact = checkShouldCollapseMessage(prevMessage, message);
        resultOptimisticMessages.push(
          isCompact ? { ...message, isCompact } : message
        );
      }
      return messages.data.items.concat(resultOptimisticMessages);
    } else return messages.data?.items;
  }, [messages.data?.items, optimisticMessages]);

  const syncModeInfo = syncModeMapping[syncMode];

  return (
    <Paper
      elevation={1}
      className={clsx(
        `min-h-0 flex-1 flex flex-col rounded-none ring ring-mui-divider`
      )}
      ref={wrapperRef}
    >
      <HorizontalStack
        withPadding
        addClassName="justify-between items-center border-b border-mui-divider relative"
      >
        <Tooltip title={`Realtime sync status: ${syncModeInfo.label}`}>
          <div className="p-2 absolute top-0 left-0">
            <div
              className={clsx(
                "h-1.5 w-1.5 rounded-full animate-pulse",
                syncModeInfo.className
              )}
            ></div>
          </div>
        </Tooltip>
        <Typography>Some text</Typography>
        {/* TODO */}
        {user.data?.user &&
          hasPermissions(user.data.user, ["messages.createSpam"]) && (
            <Button
              variant="outlined"
              onClick={() => {
                // setSyncMode(isPolling ? "ws-syncing" : "polling");
                // if (!isPolling) {
                //   setInitialGateOpenedReason("default");
                // }
                messagesCreateSpamMutation.mutate({
                  channelId: channel.id,
                  reply_to_message_id: messageToReply?.id,
                  isBulk: false,
                });
              }}
            >
              Spam messages
            </Button>
          )}

        <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} noValidate>
          <Input
            control={searchForm.control}
            name="text"
            label="Search messages"
            type="text"
            className="w-3xs"
            endAccessory="clear"
            autoComplete="off"
            size="small"
          />
        </form>
      </HorizontalStack>
      <div className="w-full min-h-0 flex flex-col flex-1">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {shouldRenderList ? (
            <Virtuoso
              key={messagesQueryKey.around || "default"}
              ref={virtuosoRef}
              className="h-full"
              firstItemIndex={firstItemIndex}
              initialTopMostItemIndex={{
                index: initialTopMostItemIndex,
                align: "center",
              }}
              increaseViewportBy={{
                bottom: 1000,
                top: 1000,
              }}
              alignToBottom
              followOutput={
                messages.data?.items.length && !messages.hasNextPage
                  ? (isAtBottom) => {
                      return isAtBottom ? "smooth" : false;
                    }
                  : undefined
              }
              rangeChanged={(range) => {
                visibleRangeRef.current = {
                  visibleStartIndex: range.startIndex,
                  visibleEndIndex: range.endIndex,
                };
                isIdleRef.current = false;
                debouncedMakeIdle();
              }}
              scrollerRef={(el) => {
                if (el instanceof HTMLElement) {
                  scrollerElRef.current = el;
                }
              }}
              totalListHeightChanged={() => {
                isIdleRef.current = false;
                debouncedMakeIdle();
              }}
              atBottomThreshold={50}
              data={renderedMessages}
              computeItemKey={(_, item) => item.id}
              itemContent={(_, message) => {
                return (
                  <MessageComponent
                    message={message}
                    totalItems={totalItems}
                    shouldHighlight={
                      !isMessageHighlightConsumed &&
                      isInitialScrollHandled &&
                      urlMessageId === String(message.id)
                    }
                    isIdleTrigger={isIdleTrigger}
                    isIdleRef={isIdleRef}
                    onHighlightConsumed={() => {
                      setIsMessageHighlightConsumed(true);
                    }}
                    onUpdateSuccess={(data) => {
                      if (handleNewMessagesVersion(data.messagesVersion)) {
                        editMessage(data, appliedMessagesVersion.current);
                      }
                      onOwnMessageActionSuccess();
                    }}
                    onDeleteSuccess={(data) => {
                      if (handleNewMessagesVersion(data.messagesVersion)) {
                        deleteMessage(data, appliedMessagesVersion.current);
                      }
                      onOwnMessageActionSuccess();
                    }}
                    onOptimisticFailedRetry={() => {
                      deleteOptimisticMessage(message.id);
                      messageCreateMutation.mutate({
                        channelId: message.channel_id,
                        content: message.content,
                        reply_to_message_id: message.reply_to_message_id,
                      });
                    }}
                    onOptimisticFailedDelete={() => {
                      deleteOptimisticMessage(message.id);
                    }}
                    onReplyClick={() => {
                      setMessageToReply({
                        id: message.id,
                        author: { name: message.author.name },
                      });
                      form.setFocus("content");
                    }}
                    onReportClick={() => {
                      globalModal.openModal({
                        props: { title: "Report Message" },
                        content: (
                          <ReportMessageForm
                            message={message}
                            onCancel={() => {}}
                            onConfirm={() => {}}
                          />
                        ),
                      });
                    }}
                  />
                );
              }}
              context={virtuosoContext}
              components={MessagesComponents}
            />
          ) : messages.isError ? (
            <VerticalStack
              addClassName="flex-1 justify-center items-center"
              withPadding
            >
              <Typography color="warning" variant="body2">
                Failed to load any messages
              </Typography>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<ReplayIcon />}
                onClick={retryInvalidate}
                size="large"
                className="w-fit"
              >
                {messagesQueryKey.around ? "Load latest messages" : "Retry"}
              </Button>
            </VerticalStack>
          ) : messages.isFetching || !isInitialGateOpened || totalItems ? (
            <MessagesSkeleton fullHeight />
          ) : (
            <ChannelHeader channel={channel} />
          )}
        </div>

        {user.data?.user?.id ? (
          <>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="message-form"
              noValidate
            >
              {!!messageToReply && (
                <HorizontalStack
                  addClassName="justify-between items-center pb-2"
                  fullWidth
                >
                  <HorizontalStack addClassName="items-center" spacing="xs">
                    <ReplyIcon fontSize="small" className="-scale-x-100" />
                    <Typography>
                      Replying to{" "}
                      <Typography component={"span"} color="secondary">
                        <strong>{messageToReply.author.name}</strong>
                      </Typography>
                    </Typography>
                  </HorizontalStack>
                  <Tooltip title="Cancel replying">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setMessageToReply(null);
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </HorizontalStack>
              )}
              <MessageEditor
                control={form.control}
                name="content"
                placeholder={`Message #${channel.name}`}
                hideError
              />
            </form>
          </>
        ) : (
          <VerticalStack
            spacing="xs"
            addClassName="p-2 bg-mui-FilledInput-bg items-center"
          >
            <Typography>Please log in to send a message.</Typography>
            <HorizontalStack addClassName="justify-center">
              <Button
                isLoading={guestLoginMutation.isPending}
                disabled={authDisabled}
                color="inherit"
                variant="contained"
                size="large"
                onClick={onGuestClick}
                startIcon={<PersonIcon />}
              >
                Continue as guest
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  authModal.openModal("login");
                }}
                size="large"
                disabled={authDisabled}
              >
                Log in
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  authModal.openModal("signup");
                }}
                size="large"
                disabled={authDisabled}
              >
                Sign up
              </Button>
            </HorizontalStack>
            <TermsLabel hideMargin />
          </VerticalStack>
        )}
      </div>
    </Paper>
  );
};

const Channel: AppPage = () => {
  const router = useRouter();
  const channels = trpc.channels.get.useQuery(undefined, {
    staleTime: CACHE_TIME_MS.NORMAL,
  });

  const urlChannelId = useMemo(
    () => getRouterQueryValue(router.query.channelId),
    [router.query.channelId]
  );
  const foundChannel = useMemo(
    () => channels.data?.items.find((c) => String(c.id) === urlChannelId),
    [channels.data?.items, urlChannelId]
  );

  return (
    <div className="flex-1 flex flex-col mt-3 min-h-0">
      <HorizontalStack addClassName="flex-1 min-h-0">
        <ChannelListWrapper />
        {!urlChannelId || channels.isPending ? null : !foundChannel ? (
          <div>Channel not found</div>
        ) : (
          <LoadingBoundary addClassName="min-h-0 h-full flex-1">
            <MessageListOrchestrator
              key={foundChannel.id}
              channel={foundChannel}
            />
          </LoadingBoundary>
        )}
      </HorizontalStack>
    </div>
  );
};

Channel.disablePadding = true;

export default Channel;
