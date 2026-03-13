import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type GetStaticProps } from "next";
import Button from "@/components/Button/Button";
import clsx from "clsx";
import ViewListIcon from "@mui/icons-material/ViewList";
import PersonIcon from "@mui/icons-material/Person";
import { Paper, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import ReplayIcon from "@mui/icons-material/Replay";
import debounce from "lodash/debounce";

import { utils as serverUtils } from "@/server";
import { type RouterInput, RouterOutput, trpc } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import { Comment } from "@/components/CommentsList/CommentsList";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import {
  useGlobalDrawer,
  useGlobalModal,
  useLocalDrawer,
  useLocalModal,
} from "@/utils/hooks/useOverlay";
import {
  defaultPadding,
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import { useAppSnackbar } from "@/utils/snackbar";
import { CACHE_TIME_MS, seconds } from "@/utils/cacheTime";
import IconButton from "@/components/Button/IconButton";
import Tooltip from "@/components/Tooltip/Tooltip";
import { SectionWrapper } from "@/pages/app/my-profile";
import { Divider } from "@/components/Layout/Dividers";
import { userLoginLifecycle } from "@/trpc/helpers/userLifecycle";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import z from "zod";
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
import { useWebsockets } from "@/trpc/hooks/useWebsockets";
import {
  getChannelId,
  subscribeWs,
  type WebsocketPayload,
  type WebsocketItem,
} from "@/trpc/helpers/websockets";
import { getQueryKey } from "@trpc/react-query";
import ChannelListWrapper from "@/components/Chat/ChannelList";
import Skeleton from "@/components/Skeleton/Skeleton";
import { useScreenHeight } from "@/utils/hooks/useScreenHeight";
import { useEffectAfterMount } from "@/utils/hooks/useEffectAfterMount";
import { numericIdQuerySchemaRaw } from "@/utils/validators/helpers/custom";

type Options = {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
  enabled?: boolean;
};

export function useOnEnterView(
  onIntersectionChange: (isVisible: boolean) => void,
  {
    root = null,
    rootMargin = "0px",
    threshold = 0,
    enabled = true,
  }: Options = {}
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onIntersectionChangeRef = useRef(onIntersectionChange);
  // eslint-disable-next-line
  onIntersectionChangeRef.current = onIntersectionChange;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        onIntersectionChangeRef.current(entry.isIntersecting);
      },
      { root, rootMargin, threshold }
    );

    io.observe(el);

    return () => io.disconnect();
  }, [enabled, root, rootMargin, threshold]);

  return ref;
}

const BASE_INDEX = 1_000_000_000;
const PER_PAGE = 50;
const MAX_PAGES = 5;

const SKELETON_CONFIG = {
  AVG_ROW_HEIGHT_PX: 80,
  MIN_ROWS: 1,
  MAX_ROWS: 60,
  WIDTHS: [0.35, 0.55, 0.7, 0.42, 0.62, 0.48, 0.8],
} as const;

const emptyFunc = () => {};

const MessagesSkeleton = ({
  scrollerEl,
  onIntersectionChange,
  fullHeight,
}: {
  scrollerEl?: HTMLElement | null;
  onIntersectionChange?: (isVisible: boolean) => void;
  fullHeight?: boolean;
}) => {
  const screenHeight = useScreenHeight();

  const rowCount = useMemo(() => {
    const rawCount = Math.ceil(
      screenHeight / (fullHeight ? 1 : 2) / SKELETON_CONFIG.AVG_ROW_HEIGHT_PX
    );
    return Math.min(
      SKELETON_CONFIG.MAX_ROWS,
      Math.max(SKELETON_CONFIG.MIN_ROWS, rawCount)
    );
  }, [screenHeight, fullHeight]);

  const onIntersectionChangeCallback = onIntersectionChange || emptyFunc;
  const ref = useOnEnterView(onIntersectionChangeCallback, {
    root: scrollerEl,
    enabled: Boolean(onIntersectionChange),
    rootMargin: "200px 0px",
    threshold: 0,
  });

  return (
    <div className="p-2" ref={ref}>
      {Array.from({ length: rowCount }).map((_, i) => {
        const widthPercent =
          100 * SKELETON_CONFIG.WIDTHS[i % SKELETON_CONFIG.WIDTHS.length];
        return (
          <HorizontalStack key={i} addClassName="items-center">
            <Skeleton variant="circular" height={50} width={50} />
            <Skeleton
              height={SKELETON_CONFIG.AVG_ROW_HEIGHT_PX}
              width={`${widthPercent}%`}
            />
          </HorizontalStack>
        );
      })}
    </div>
  );
};

const searchSchemaForm = z.object({
  text: Text.Long(),
});

type SearchFormValues = z.infer<typeof searchSchemaForm>;

type MessageQueryOptions = Parameters<
  typeof trpc.messages.get.useInfiniteQuery
>[1];

type Message = RouterOutput["messages"]["get"]["items"][number];

const messageQuerySelectors = {
  getPreviousPageParam: (firstPage, _, firstPageParam) => {
    if (firstPage.returnedDirection === "backward") {
      return firstPage.items.length === PER_PAGE
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
    if (lastPage.returnedDirection === "forward") {
      return lastPage.items.length === PER_PAGE
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
  select: (data) => ({
    ...data,
    items: data.pages.flatMap((p) => p.items),
  }),
} satisfies NonNullable<MessageQueryOptions>;

const baseIntervalMs = Number(seconds(5));

type Props = {
  channel: RouterOutput["channels"]["get"]["items"][number];
};

const ChannelInner = ({ channel }: Props) => {
  const localModal = useLocalModal();
  const { closeModal, openModal } = useGlobalModal();
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
  //const isIdleRef = useRef(false);
  const [isInitialScrollHandled, setIsInitialScrollHandled] =
    useState<boolean>(true);
  const [isMessageHighlightConsumed, setIsMessageHighlightConsumed] =
    useState<boolean>(false);

  const [queryInitializing, setQueryInitializing] = useState<boolean | null>(
    null
  ); // null for initial render before router is ready
  const [syncMode, setSyncMode] = useState<
    "polling" | "ws-syncing" | "ws-live"
  >("polling");
  const [wsSyncFailedCount, setWsSyncFailedCount] = useState<number>(0);
  const [messagesQueryKey, setMessagesQueryKey] = useState<
    RouterInput["messages"]["get"]
  >({ limit: PER_PAGE, channelId: channelIdString });

  const isPolling = syncMode === "polling";
  const isWsSyncing = syncMode === "ws-syncing";
  const isWsLive = syncMode === "ws-live";
  console.log({ syncMode });

  const isWsConnectedRef = useRef<boolean>(false);

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
      enabled: queryInitializing === false,
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

  useEffect(() => {
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

  const foundMessageIndex = useMemo(
    () =>
      urlMessageId &&
      messages.data?.items &&
      (!isMessageHighlightConsumed || !isInitialScrollHandled)
        ? messages.data.items.findIndex((m) => m.id === BigInt(urlMessageId))
        : -1,
    [
      messages.data?.items,
      urlMessageId,
      isMessageHighlightConsumed,
      isInitialScrollHandled,
    ]
  );

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

  const { highestLoadedId, lowestLoadedId } = useMemo(() => {
    if (!messages.data?.items.length) {
      return {
        highestLoadedId: null,
        lowestLoadedId: null,
      };
    }
    return {
      highestLoadedId: messages.data.items[messages.data.items.length - 1].id,
      lowestLoadedId: messages.data.items[0].id,
    };
  }, [messages.data?.items]);

  const websocketsDependencies = useRef({
    messagesQueryKey,
    highestLoadedId,
    lowestLoadedId,
    firstItemIndex,
    messages,
    isPolling,
    isWsSyncing,
    handleNewMessagesVersion,
    utils,
  });

  websocketsDependencies.current = {
    messagesQueryKey,
    highestLoadedId,
    lowestLoadedId,
    firstItemIndex,
    messages,
    isPolling,
    isWsSyncing,
    handleNewMessagesVersion,
    utils,
  };

  const websocketsClient = useWebsockets({ channelId: channelIdString });

  const websocketsMessageQueue = useRef<WebsocketItem[]>([]);

  const wsMessageCreateHandler = useCallback(
    (
      data: WebsocketPayload<"messages:create">,
      isApplyingBufferedEvents?: boolean
    ) => {
      const {
        messagesQueryKey,
        isPolling,
        isWsSyncing,
        messages,
        handleNewMessagesVersion,
        utils,
      } = websocketsDependencies.current;
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

      utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
        if (!queryData || !queryData.pages.length || messages.hasNextPage) {
          return queryData;
        }
        let updatedPages = [...queryData.pages];
        const newMessage: Message = {
          ...message,
          created_at: new Date(message.created_at),
          updated_at: new Date(message.updated_at),
          id: BigInt(message.id),
          channel_id: BigInt(message.channel_id),
        };

        updatedPages[updatedPages.length - 1] = {
          ...updatedPages[updatedPages.length - 1],
          items: [...updatedPages[updatedPages.length - 1].items, newMessage],
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
            id: newMessage.id,
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
    },
    []
  );

  const wsMessageUpdateHandler = useCallback(
    (
      data: WebsocketPayload<"messages:update">,
      isApplyingBufferedEvents?: boolean
    ) => {
      const message = data.message;

      const {
        messagesQueryKey,
        isWsSyncing,
        isPolling,
        handleNewMessagesVersion,
        utils,
      } = websocketsDependencies.current;
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
              created_at: new Date(message.created_at),
              updated_at: new Date(message.updated_at),
              id: itemToUpdateId,
              channel_id: BigInt(message.channel_id),
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
        firstItemIndex,
        messagesQueryKey,
        isWsSyncing,
        isPolling,
        handleNewMessagesVersion,
        utils,
      } = websocketsDependencies.current;
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
    },
    []
  );

  useEffect(() => {
    if (!websocketsClient) return;

    let isEffectCleanup = false;

    const websocketsChannel = websocketsClient.channels.get(
      getChannelId(channelIdString)
    );

    const onConnectionLost = () => {
      if (isEffectCleanup) return;
      const { isPolling } = websocketsDependencies.current;
      isWsConnectedRef.current = false;
      if (!isPolling) {
        setSyncMode("polling");
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
      if (isWsConnected && isWsChannelAttached) {
        isWsConnectedRef.current = true;
        websocketsMessageQueue.current = [];
        setWsSyncFailedCount(0);
        setSyncMode("ws-syncing");
      }
    };

    websocketsClient.connection.on(
      ["disconnected", "suspended", "closing", "closed", "failed"],
      onConnectionLost
    );
    websocketsChannel.on(["detached", "suspended", "failed"], onConnectionLost);
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
  }, [websocketsClient, channel.id]);

  const startedRefetchingForWsSync = useRef<boolean>(false);

  useLayoutEffect(() => {
    if (isWsSyncing) {
      startedRefetchingForWsSync.current = false;
    }
  }, [isWsSyncing]);

  useEffect(() => {
    if (
      isWsSyncing &&
      !messages.isFetching &&
      isIdle &&
      !startedRefetchingForWsSync.current
    ) {
      startedRefetchingForWsSync.current = true;
      messages.refetch();
    }
  }, [isWsSyncing, messages.isFetching, isIdle]);

  useEffect(() => {
    const data = messages.data;
    if (!data?.pages.length) return;

    if (!hasQueryLoadedInitialData.current) {
      hasQueryLoadedInitialData.current = true;
      appliedMessagesVersion.current = data.pages[0].messages_version;
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

      if (!isWsSyncing) return;

      const relevantEvents = websocketsMessageQueue.current
        .filter(
          (e) => BigInt(e.data.messagesVersion) > lowestRefetchedMessagesVersion
        )
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
              maxVersion >= highestRefetchedMessagesVersion &&
              minVersion === lowestRefetchedMessagesVersion + BigInt(1) &&
              maxVersion - minVersion + BigInt(1) ===
                BigInt(relevantEvents.length)
            );
          })()
        : lowestRefetchedMessagesVersion === highestRefetchedMessagesVersion;

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

      startedRefetchingForWsSync.current = false;
      websocketsMessageQueue.current = [];
      setWsSyncFailedCount(0);
      setSyncMode("ws-live");
    }
  }, [messages.isRefetching]);

  const messagesCreateSpamMutation = trpc.messages.createSpam.useMutation({
    onSuccess: () => {
      utils.messages.get.invalidate();
    },
  });

  const messageCreateMutation = trpc.messages.create.useMutation({
    onSuccess: () => {
      form.reset();
      if (isPolling) {
        utils.messages.get.invalidate();
      }
    },
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
    messageCreateMutation.mutate(values);
  };
  const onSearchSubmit: SubmitHandler<SearchFormValues> = (values) => {
    setUrlMessageId(values.text);
  };

  const authDisabled = guestLoginMutation.isPending || user.isFetching;

  // console.log({
  //   appliedMessagesVersion: appliedMessagesVersion.current,
  // });

  const tryLoadOlder = async (ignoreError?: boolean) => {
    if (ignoreError ? false : messages.isFetchPreviousPageError) {
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

  console.log({ ...messages });

  const tryLoadNewer = async (ignoreError?: boolean) => {
    if (ignoreError ? false : messages.isFetchNextPageError) {
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

  const debouncedLoadersDependencies = useRef({
    isIdle,
  });
  debouncedLoadersDependencies.current = {
    isIdle,
  };

  // eslint-disable-next-line
  const debouncedMakeIdle = useCallback(
    // eslint-disable-next-line
    debounce(async () => {
      const { isIdle } = debouncedLoadersDependencies.current;
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
    if (wsSyncFailedCount > 0) {
      setSyncMode("polling");
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

  const resetMessagesList = () => {
    refetchIntervalVars.current.wasFetching = false;
    refetchIntervalVars.current.currentIntervalMs = baseIntervalMs;
    hasQueryLoadedInitialData.current = false;
    wasRefetching.current = false;
    userInteractedRef.current = false;
    websocketsMessageQueue.current = [];
    startedRefetchingForWsSync.current = false;
    setWsSyncFailedCount(0);
    setSyncMode("polling");
    setQueryInitializing(true);
    setIsInitialScrollHandled(false);
    setIsMessageHighlightConsumed(false);
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
    if (!queryInitializing) return;

    if (foundMessageIndex < 0) {
      qc.removeQueries({
        queryKey: getQueryKey(trpc.messages.get, messagesQueryKey, "infinite"),
        exact: true,
      });
      setMessagesQueryKey((prev) => ({
        ...prev,
        around: urlMessageId || undefined,
      }));
    }

    setQueryInitializing(false);

    // eslint-disable-next-line
  }, [queryInitializing]);

  useEffect(() => {
    if (
      queryInitializing !== false ||
      isInitialScrollHandled ||
      !messages.data?.items.length ||
      !isIdle
    ) {
      return;
    }
    if (urlMessageId) {
      if (foundMessageIndex < 0) {
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
    queryInitializing,
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

  return (
    <Paper
      elevation={1}
      className={clsx(
        `min-h-0 flex-1 flex flex-col rounded-none ring ring-[var(--mui-palette-divider)]`
      )}
      ref={wrapperRef}
    >
      <HorizontalStack addClassName="justify-between items-center">
        <Typography>Some text</Typography>
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
              data={messages.data?.items}
              computeItemKey={(_, item) => String(item.id)}
              itemContent={(_, comment) => {
                return (
                  <Comment
                    comment={comment}
                    shouldHighlight={
                      !isMessageHighlightConsumed &&
                      isInitialScrollHandled &&
                      urlMessageId === String(comment.id)
                    }
                    onHighlightConsumed={() => {
                      setIsMessageHighlightConsumed(true);
                    }}
                    isPolling={isPolling}
                  />
                );
              }}
              context={virtuosoContext}
              components={MessagesComponents}
            />
          ) : messages.isFetching ? (
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
                  onClick={() => {
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
        {!urlChannelId ? null : !foundChannel ? (
          <div>Channel not found</div>
        ) : (
          <LoadingBoundary addClassName="min-h-0 h-full flex-1">
            <ChannelInner key={foundChannel.id} channel={foundChannel} />
          </LoadingBoundary>
        )}
      </HorizontalStack>
    </div>
  );
};

Channel.disablePadding = true;

export default Channel;
