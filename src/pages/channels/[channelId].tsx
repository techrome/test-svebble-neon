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
import ViewListIcon from "@mui/icons-material/ViewList";
import PersonIcon from "@mui/icons-material/Person";
import { CircularProgress, Paper, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import ReplayIcon from "@mui/icons-material/Replay";
import debounce from "lodash/debounce";
import z from "@/utils/zod";
import { getQueryKey } from "@trpc/react-query";

import { type RouterInput, RouterOutput, trpc } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import {
  Comment,
  type RenderedMessage,
} from "@/components/CommentsList/CommentsList";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import {
  useGlobalDrawer,
  useGlobalModal,
  useLocalDrawer,
  useLocalModal,
} from "@/utils/hooks/useOverlay";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import { useAppSnackbar } from "@/utils/snackbar";
import { CACHE_TIME_MS, minutes, seconds } from "@/utils/cacheTime";
import IconButton from "@/components/Button/IconButton";
import Tooltip from "@/components/Tooltip/Tooltip";
import { userLoginLifecycle } from "@/trpc/helpers/userLifecycle";
import { useQueryClient } from "@tanstack/react-query";
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
} from "@/utils/validators/shared/messages";
import { useRouter } from "next/router";
import { getRouterQueryValue } from "@/utils/query";
import {
  getChannelId,
  subscribeWs,
  type WebsocketPayload,
  type WebsocketItem,
  type MessageSerializable,
} from "@/trpc/helpers/websockets";
import ChannelListWrapper from "@/components/Chat/ChannelList";
import { numericIdQuerySchemaRaw } from "@/utils/validators/helpers/custom";
import { TermsLabel } from "@/components/AuthForm/Helpers";
import { useWsClient } from "@/components/WebsocketsProvider/WebsocketsProvider";
import { MessagesSkeleton } from "@/components/Chat/MessagesSkeleton";
import { isWithinMs } from "@/utils/timeUtils";
import ReportMessageForm from "@/components/Chat/ReportMessageForm";

const deserializeMessage = (
  serializedMessage: MessageSerializable
): Message => ({
  ...serializedMessage,
  created_at: new Date(serializedMessage.created_at),
  updated_at: new Date(serializedMessage.updated_at),
  id: BigInt(serializedMessage.id),
  channel_id: BigInt(serializedMessage.channel_id),
});

const BASE_INDEX = 1_000_000_000;
const PER_PAGE = 50;
const MAX_PAGES = 5;
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
      isWithinMs(message.created_at, prevMessage.created_at, minutes(5))
  );
};

const COMPACT_GAP_MS = minutes(5);
const MAX_GROUP_AGE_MS = minutes(20);
const MAX_GROUP_MESSAGES = 15;

type MessageQueryOptions = Parameters<
  typeof trpc.messages.get.useInfiniteQuery
>[1];

type Message = RouterOutput["messages"]["get"]["items"][number];

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
      return newCursorId && newCursorId >= BigInt(0)
        ? { id: newCursorId, direction: "forward" }
        : undefined;
    }
  },
  select: (data) => {
    let items: (Message & Pick<RenderedMessage, "isCompact">)[] = [];

    // collapsing messages by the same user within a short period of time
    // while having sane limits on how many messages can be collapsed consecutively
    let groupUserId: Message["user_id"] | undefined;
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

        const continuesPreviousGroup =
          !!prevMessage &&
          prevMessage.user_id === message.user_id &&
          isWithinMs(
            message.created_at,
            prevMessage.created_at,
            COMPACT_GAP_MS
          ) &&
          groupUserId === message.user_id &&
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
          groupUserId = message.user_id;
          groupStartCreatedAt = message.created_at;
          groupMessageCount = 1;
          items.push(message);
        }
      }
    }

    return {
      ...data,
      items,
    };
  },
} satisfies NonNullable<MessageQueryOptions>;

const baseIntervalMs = Number(seconds(5));

type SyncMode = "polling" | "ws-syncing" | "ws-live";

const syncModeMapping = {
  polling: {
    label: "refetching periodically",
    className: "bg-[var(--mui-palette-warning-main)]",
  },
  "ws-syncing": {
    label: "syncing",
    className: "bg-[var(--mui-palette-info-main)]",
  },
  "ws-live": {
    label: "live",
    className: "bg-[var(--mui-palette-success-main)]",
  },
} as const satisfies Record<SyncMode, { label: string; className: string }>;

type Props = {
  channel: RouterOutput["channels"]["get"]["items"][number];
};

const MessageListOrchestrator = ({ channel }: Props) => {
  const localModal = useLocalModal();
  const globalModal = useGlobalModal();
  const localDrawer = useLocalDrawer();
  const { openDrawer, closeDrawer } = useGlobalDrawer();
  const { addAppSnackbar, dismissAllAppSnackbars } = useAppSnackbar();

  const user = useUser();
  const authModal = useAuthModal();
  const qc = useQueryClient();
  const utils = trpc.useUtils();
  const router = useRouter();

  const channelIdString = useMemo(() => String(channel.id), [channel.id]);

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

  const [isIdle, setIsIdle] = useState(false);
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
    "fallback" | "websockets" | null
  >(null);
  const isInitialGateOpened = Boolean(initialGateOpenedReason);
  const initialTimerToOpenGateRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const [isPreparingQuery, setIsPreparingQuery] = useState<boolean | null>(
    null
  ); // null for initial render before router is ready
  const [syncMode, setSyncMode] = useState<SyncMode>("polling");
  const [wsSyncFailedCount, setWsSyncFailedCount] = useState<number>(0);
  const [messagesQueryKey, setMessagesQueryKey] = useState<
    RouterInput["messages"]["get"]
  >({ limit: PER_PAGE, channelId: channelIdString });
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
          Exclude<
            NonNullable<MessageQueryOptions>["refetchInterval"],
            number | boolean | undefined
          >
        >[0]["state"]["data"]
      | undefined;
    currentIntervalMs: number;
    maxIntervalMs: number;
    intervalStepMs: number;
    wasFetching: boolean;
  }>({
    dataBefore: undefined,
    currentIntervalMs: baseIntervalMs,
    maxIntervalMs: Number(seconds(30)),
    intervalStepMs: baseIntervalMs,
    wasFetching: false,
  });

  const messages = useAppQuery(
    trpc.messages.get.useInfiniteQuery(messagesQueryKey, {
      enabled: isPreparingQuery === false && isInitialGateOpened,
      ...messageQuerySelectors,
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
              ? Math.min(
                  vars.maxIntervalMs,
                  vars.currentIntervalMs + vars.intervalStepMs
                )
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

  const appendMessage = (message: Message, newMessagesVersion: bigint) => {
    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      if (!queryData || !queryData.pages.length || messages.hasNextPage) {
        return queryData;
      }
      let updatedPages = [...queryData.pages];

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

  const editMessage = (message: Message, newMessagesVersion: bigint) => {
    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      const pagesCount = queryData?.pages.length;
      if (!queryData || !pagesCount) return queryData;

      const itemToUpdateId = BigInt(message.id);
      const firstPage = queryData.pages[0];
      const lastNonEmptyPage = queryData.pages[pagesCount - 1].items.length
        ? queryData.pages[pagesCount - 1]
        : queryData.pages[pagesCount - 2];

      const lowestLoadedId = firstPage.items[0]?.id;
      const highestLoadedId =
        lastNonEmptyPage?.items?.[lastNonEmptyPage?.items?.length - 1]?.id;

      if (
        !lowestLoadedId ||
        !highestLoadedId ||
        itemToUpdateId < lowestLoadedId ||
        itemToUpdateId > highestLoadedId
      ) {
        return queryData;
      }

      let updatedPages = [...queryData.pages];
      for (let i = 0; i < updatedPages.length; i++) {
        const page = updatedPages[i];
        const foundItemIndex = page.items.findIndex(
          (m) => m.id === itemToUpdateId
        );
        if (foundItemIndex >= 0) {
          let updatedItems = [...page.items];
          updatedItems[foundItemIndex] = {
            ...message,
            id: itemToUpdateId,
          };

          updatedPages[i] = {
            ...updatedPages[i],
            items: updatedItems,
            messages_version: newMessagesVersion,
          };
          return { ...queryData, pages: updatedPages };
        }
      }
      return queryData;
    });
  };

  const deleteMessage = (
    itemToDeleteId: bigint,
    newMessagesVersion: bigint
  ) => {
    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      const pagesCount = queryData?.pages.length;
      if (!queryData || !pagesCount) return queryData;

      const firstNonEmptyPage = queryData.pages[0].items.length
        ? queryData.pages[0]
        : queryData.pages[1];
      const lastNonEmptyPage = queryData.pages[pagesCount - 1].items.length
        ? queryData.pages[pagesCount - 1]
        : queryData.pages[pagesCount - 2];

      const lowestLoadedId = firstNonEmptyPage?.items[0]?.id;
      const highestLoadedId =
        lastNonEmptyPage?.items?.[lastNonEmptyPage?.items?.length - 1]?.id;

      if (
        !lowestLoadedId ||
        !highestLoadedId ||
        itemToDeleteId < lowestLoadedId ||
        itemToDeleteId > highestLoadedId
      ) {
        return queryData;
      }

      let updatedPages = [...queryData.pages];
      let updatedPageParams = [...queryData.pageParams];

      let targetMessageGlobalIndex = firstItemIndex || 0;
      for (let i = 0; i < updatedPages.length; i++) {
        const page = updatedPages[i];
        const foundItemIndex = page.items.findIndex(
          (m) => m.id === itemToDeleteId
        );
        if (foundItemIndex < 0) {
          targetMessageGlobalIndex += page.items.length;
          continue;
        }

        targetMessageGlobalIndex += foundItemIndex;
        const visibleGlobalStartIndex =
          visibleRangeRef.current?.visibleStartIndex || 0;
        const isTargetMessageAboveViewport =
          targetMessageGlobalIndex < visibleGlobalStartIndex;

        let updatedItems = [...page.items];
        updatedItems.splice(foundItemIndex, 1);
        if (!updatedItems.length && i !== updatedPages.length - 1) {
          updatedPages.splice(i, 1);
          updatedPageParams.splice(i, 1);
        } else {
          updatedPages[i] = {
            ...updatedPages[i],
            items: updatedItems,
            messages_version: newMessagesVersion,
          };
        }
        if (isTargetMessageAboveViewport) {
          setFirstItemIndex((prev) => (prev !== null ? prev + 1 : prev));
        }

        break;
      }
      return {
        ...queryData,
        pages: updatedPages,
        pageParams: updatedPageParams,
      };
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
    isIdle,
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
    isIdle,
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

      appendMessage(deserializeMessage(message), newMessagesVersion);
    },
    []
  );

  const wsMessageUpdateHandler = useCallback(
    (
      data: WebsocketPayload<"messages:update">,
      isApplyingBufferedEvents?: boolean
    ) => {
      const message = data.message;

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

      editMessage(deserializeMessage(message), newMessagesVersion);
    },
    []
  );

  const wsMessageDeleteHandler = useCallback(
    (
      data: WebsocketPayload<"messages:delete">,
      isApplyingBufferedEvents?: boolean
    ) => {
      const message = data.message;
      const itemToDeleteId = BigInt(message.id);
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

      deleteMessage(itemToDeleteId, newMessagesVersion);
    },
    []
  );

  const deleteOptimisticMessage = (id: bigint) => {
    setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const messagesCreateSpamMutation = trpc.messages.createSpam.useMutation({
    onSuccess: () => {
      utils.messages.get.invalidate();
    },
  });

  const messageCreateMutation = trpc.messages.create.useMutation({
    onMutate(variables) {
      const userId = user.data?.user?.id;
      if (!userId) return;
      const tempId = nextOptimisticIdRef.current;
      nextOptimisticIdRef.current -= BigInt(1);
      setOptimisticMessages((prev) => [
        ...prev,
        {
          channel_id: variables.channelId,
          content: variables.content,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          id: tempId,
          user_id: userId,
          isOptimistic: true,
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
      if (handleNewMessagesVersion(data.channel.messages_version)) {
        appendMessage(data.message, appliedMessagesVersion.current);
      }
      if (isPolling) {
        utils.messages.get.invalidate();
      }
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

  const commentDeleteAllMutation = trpc.messages.deleteAll.useMutation({
    onSuccess: () => {
      utils.messages.get.invalidate();
    },
  });

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
    messageCreateMutation.mutate(values);
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

        if (nextPageFirstItemId) {
          updatedPageParams[i] = {
            id: nextPageFirstItemId,
            direction: "backward",
          };
        } else if (prevPageLastItemId) {
          updatedPageParams[i] = {
            id: prevPageLastItemId,
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
      const { isIdle } = dependencies.current;
      if (!isIdle) {
        setIsIdle(true);
      }
    }, 100),
    []
  );

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
        setInitialGateOpenedReason("fallback");
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
          initialGateOpenedReason ? "fallback" : "websockets"
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
    (!shouldRenderList || isIdle) &&
    initialGateOpenedReason === "fallback" &&
    !hasStartedWsSyncRefetch.current;

  useEffect(() => {
    if (shouldStartWsSyncRefetch) {
      hasStartedWsSyncRefetch.current = true;
      messages.refetch();
    }
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
      return;
    }
  }, [messages.dataUpdatedAt]);

  useEffect(() => {
    const data = messages.data;
    if (!data?.pages.length) return;

    const prevWasRefetching = wasRefetching.current;
    wasRefetching.current = messages.isRefetching;

    if (prevWasRefetching && !messages.isRefetching) {
      if (messages.isRefetchError) {
        setSyncMode("polling");
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
  }, [messages.isRefetching]);

  useEffect(() => {
    if (wsSyncFailedCount > 0) {
      setSyncMode("polling");
      setInitialGateOpenedReason("fallback");
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
          setInitialGateOpenedReason("fallback");
        } else {
          setInitialGateOpenedReason(null);
          initialTimerToOpenGateRef.current = setTimeout(() => {
            setInitialGateOpenedReason("fallback");
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
      !isIdle
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
          behavior: "smooth",
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
    isIdle,
  ]);

  const virtuosoContext = {
    messages,
    scrollerElRef,
    retryInvalidate,
    tryLoadOlder,
    tryLoadNewer,
    isIdle,
    isWsSyncing,
  };

  const MessagesHeader = useMemo(
    () =>
      ({ context }: { context: typeof virtuosoContext }) => {
        const { messages, tryLoadOlder, scrollerElRef, isIdle, isWsSyncing } =
          context;

        // eslint-disable-next-line
        const [isLoaderVisible, setIsLoaderVisible] = useState(false);

        // eslint-disable-next-line
        useEffect(() => {
          let timeout: null | ReturnType<typeof setTimeout> = null;
          if (!messages.hasPreviousPage) {
            setIsLoaderVisible(false);
            return;
          }
          if (
            isLoaderVisible &&
            isIdle &&
            !isWsSyncing &&
            messages.hasPreviousPage &&
            !messages.isFetching &&
            !messages.isError
          ) {
            timeout = setTimeout(() => {
              tryLoadOlder();
            }, 50);
          }
          return () => {
            if (timeout) {
              clearTimeout(timeout);
            }
          };
          // eslint-disable-next-line
        }, [
          isLoaderVisible,
          isIdle,
          isWsSyncing,
          messages.isFetching,
          messages.isError,
          messages.hasPreviousPage,
        ]);

        if (messages.isFetchPreviousPageError) {
          return (
            <VerticalStack>
              <Typography>Failed to load older messages</Typography>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<ReplayIcon />}
                onClick={() => tryLoadOlder(true)}
                size="large"
                className="w-fit"
              >
                Retry
              </Button>
            </VerticalStack>
          );
        }
        if (messages.hasPreviousPage) {
          return (
            <MessagesSkeleton
              scrollerEl={scrollerElRef.current}
              onIntersectionChange={(isVisible) => {
                setIsLoaderVisible(isVisible);
              }}
            />
          );
        }
        return null;
      },
    []
  );
  const MessagesFooter = useMemo(
    () =>
      ({ context }: { context: typeof virtuosoContext }) => {
        const {
          messages,
          scrollerElRef,
          retryInvalidate,
          tryLoadNewer,
          isIdle,
          isWsSyncing,
        } = context;

        // eslint-disable-next-line
        const [isLoaderVisible, setIsLoaderVisible] = useState(false);

        // eslint-disable-next-line
        useEffect(() => {
          let timeout: null | ReturnType<typeof setTimeout> = null;
          if (!messages.hasNextPage) {
            setIsLoaderVisible(false);
            return;
          }
          if (
            isLoaderVisible &&
            isIdle &&
            !isWsSyncing &&
            messages.hasNextPage &&
            !messages.isFetching &&
            !messages.isError
          ) {
            timeout = setTimeout(() => {
              tryLoadNewer();
            }, 50);
          }
          return () => {
            if (timeout) {
              clearTimeout(timeout);
            }
          };
          // eslint-disable-next-line
        }, [
          isLoaderVisible,
          isIdle,
          isWsSyncing,
          messages.isFetching,
          messages.isError,
          messages.hasNextPage,
        ]);

        if (messages.isFetchNextPageError) {
          return (
            <VerticalStack>
              <Typography>Failed to load newer messages</Typography>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<ReplayIcon />}
                onClick={() => tryLoadNewer(true)}
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
            <VerticalStack>
              <Typography>Failed to load messages</Typography>
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
          return (
            <MessagesSkeleton
              scrollerEl={scrollerElRef.current}
              onIntersectionChange={(isVisible) => {
                setIsLoaderVisible(isVisible);
              }}
            />
          );
        }

        return null;
      },
    []
  );

  const MessagesComponents = useMemo(
    () => ({
      Header: MessagesHeader,
      Footer: MessagesFooter,
    }),
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
        `min-h-0 flex-1 flex flex-col rounded-none ring ring-[var(--mui-palette-divider)]`
      )}
      ref={wrapperRef}
    >
      <HorizontalStack
        withPadding
        addClassName="justify-between items-center border-b border-(--mui-palette-divider) relative"
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
        <Button
          variant="outlined"
          onClick={() => {
            setSyncMode(isPolling ? "ws-syncing" : "polling");
          }}
        >
          Current polling - {isPolling ? "ON" : "OFF"}
        </Button>

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
        <div className="flex-1 min-h-0 overflow-y-auto">
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
                bottom: 100,
                top: 100,
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
                setIsIdle(false);
                debouncedMakeIdle();
              }}
              scrollerRef={(el) => {
                if (el instanceof HTMLElement) {
                  scrollerElRef.current = el;
                }
              }}
              atBottomThreshold={50}
              data={renderedMessages}
              computeItemKey={(_, item) => String(item.id)}
              itemContent={(_, message) => {
                return (
                  <Comment
                    comment={message}
                    shouldHighlight={
                      !isMessageHighlightConsumed &&
                      isInitialScrollHandled &&
                      urlMessageId === String(message.id)
                    }
                    onHighlightConsumed={() => {
                      setIsMessageHighlightConsumed(true);
                    }}
                    onUpdateSuccess={(data) => {
                      if (
                        handleNewMessagesVersion(data.channel.messages_version)
                      ) {
                        editMessage(
                          data.message,
                          appliedMessagesVersion.current
                        );
                      }
                      if (isPolling) {
                        utils.messages.get.invalidate();
                      }
                    }}
                    onDeleteSuccess={(data) => {
                      if (
                        handleNewMessagesVersion(data.channel.messages_version)
                      ) {
                        deleteMessage(
                          data.message.id,
                          appliedMessagesVersion.current
                        );
                      }
                      if (isPolling) {
                        utils.messages.get.invalidate();
                      }
                    }}
                    onOptimisticRetry={() => {
                      deleteOptimisticMessage(message.id);
                      messageCreateMutation.mutate({
                        channelId: message.channel_id,
                        content: message.content,
                      });
                    }}
                    onOptimisticDelete={() => {
                      deleteOptimisticMessage(message.id);
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
          ) : messages.isFetching || !isInitialGateOpened ? (
            <MessagesSkeleton fullHeight />
          ) : messages.isError ? (
            <VerticalStack>
              <Typography>Failed to load any messages</Typography>
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
          ) : null}
        </div>

        {user.data?.user?.id ? (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="py-1 px-2 bg-[var(--mui-palette-FilledInput-bg)]"
            noValidate
          >
            <HorizontalStack wrap={false} addClassName="items-start">
              <Tooltip title="Attach file">
                <IconButton
                  className="mt-4"
                  type="button"
                  onClick={() => {
                    // TODO
                    commentDeleteAllMutation.mutate({ channelId: channel.id });
                  }}
                >
                  <AttachFileIcon />
                </IconButton>
              </Tooltip>
              <Input
                control={form.control}
                name="content"
                label="Message"
                fullWidth
                variant="standard"
                hideError
                multiline
                maxRows={10}
                slotProps={{
                  input: {
                    endAdornment: (
                      <HorizontalStack wrap={false} addClassName="self-start">
                        <Tooltip title="Add emoji">
                          <IconButton
                            type="button"
                            onClick={() => {
                              // TODO
                              messagesCreateSpamMutation.mutate({
                                isBulk: false,
                                count: 10,
                                channelId: channel.id,
                              });
                            }}
                          >
                            <EmojiEmotionsIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Send message">
                          <IconButton type="submit">
                            <SendIcon />
                          </IconButton>
                        </Tooltip>
                      </HorizontalStack>
                    ),
                    onKeyDown: (e) => {
                      if (e.nativeEvent.isComposing) return;

                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();

                        const form = e.currentTarget.form;
                        form?.requestSubmit();
                      }
                    },
                  },
                }}
              />
            </HorizontalStack>
          </form>
        ) : (
          <VerticalStack
            spacing="xs"
            addClassName="p-2 bg-[var(--mui-palette-FilledInput-bg)] items-center"
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
