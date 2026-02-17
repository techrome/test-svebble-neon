import React from "react";
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
import { type RouterInput, trpc } from "@/trpc";
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
import { CACHE_TIME } from "@/utils/cacheTime";
import IconButton from "@/components/Button/IconButton";
import Tooltip from "@/components/Tooltip/Tooltip";
import { SectionWrapper } from "@/pages/app/my-profile";
import { Divider } from "@/components/Layout/Dividers";
import { userLoginLifecycle } from "@/trpc/helpers/userLifecycle";
import { useQueryClient } from "@tanstack/react-query";
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
  WebsocketEventName,
} from "@/trpc/helpers/websockets";

const searchSchemaForm = z.object({
  text: Text.Long(),
});

type SearchFormValues = z.infer<typeof searchSchemaForm>;

const BASE_INDEX = 1_000_000_000;
const PER_PAGE = 6;
const MAX_PAGES = 5;
const PREFETCH_ITEMS = 4;

const initialMessageQueryKey: RouterInput["messages"]["get"] = {
  limit: PER_PAGE,
};

type MessageQueryOptions = Parameters<
  typeof trpc.messages.get.useInfiniteQuery
>[1];

const messageQuerySelectors = {
  getPreviousPageParam: (firstPage) =>
    (
      firstPage.returnedDirection === "backward"
        ? firstPage.items.length === PER_PAGE
        : firstPage.items.length
    )
      ? { id: firstPage.items[0].id, direction: "backward" }
      : undefined,
  getNextPageParam: (lastPage) =>
    (
      lastPage.returnedDirection === "forward"
        ? lastPage.items.length === PER_PAGE
        : lastPage.items.length
    )
      ? {
          id: lastPage.items[lastPage.items.length - 1].id,
          direction: "forward",
        }
      : undefined,
  select: (data) => ({
    ...data,
    items: data.pages.flatMap((p) => p.items),
  }),
} satisfies NonNullable<MessageQueryOptions>;

const HomePage: AppPage = () => {
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

  const messageCreateSchema = React.useMemo(
    () => makeMessageCreateSchemaForm(user.data?.user?.emailVerified),
    [user.data?.user?.emailVerified]
  );
  const form = useForm<MessageCreateFormValues>({
    defaultValues: { content: "" },
    resolver: zodResolver(messageCreateSchema),
  });

  const searchForm = useForm<SearchFormValues>({
    defaultValues: { text: "" },
    resolver: zodResolver(searchSchemaForm),
  });

  const visibleRangeRef = React.useRef<{
    visibleStartIndex: number;
    visibleEndIndex: number;
  } | null>(null);
  const virtuosoRef = React.useRef<VirtuosoHandle>(null);

  const [isScrollToMessageDone, setIsScrollToMessageDone] =
    React.useState<boolean>(true);
  const [isMessageHighlightConsumed, setIsMessageHighlightConsumed] =
    React.useState<boolean>(false);

  const [queryInitializing, setQueryInitializing] = React.useState<
    boolean | null
  >(null); // null for initial render before router is ready
  const [isPolling, setIsPolling] = React.useState(false);
  const [messagesQueryKey, setMessagesQueryKey] = React.useState<
    RouterInput["messages"]["get"]
  >(initialMessageQueryKey);
  const messagesQueryKeyRef = React.useRef(messagesQueryKey);
  React.useEffect(() => {
    messagesQueryKeyRef.current = messagesQueryKey;
  }, [messagesQueryKey]);

  const messages = useAppQuery(
    trpc.messages.get.useInfiniteQuery(messagesQueryKey, {
      enabled: queryInitializing === false,
      ...messageQuerySelectors,
      refetchInterval(query) {
        return query.state.error || !isPolling ? false : 4000;
      },
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      gcTime: CACHE_TIME.NORMAL,
    })
  );

  const [firstItemIndex, setFirstItemIndex] = React.useState<number | null>(
    null
  );

  const totalItems = messages.data?.items.length || 0;
  const urlMessageId = React.useMemo(
    () => getRouterQueryValue(router.query.messageId),
    [router]
  );

  const shouldRenderList =
    Boolean(messages.data?.items.length) && firstItemIndex !== null;

  const foundMessageIndex = React.useMemo(
    () =>
      urlMessageId && messages.data?.items
        ? messages.data?.items.findIndex((m) => m.id === BigInt(urlMessageId))
        : -1,
    [messages.data?.items, urlMessageId]
  );

  const initialTopMostItemIndex = React.useMemo(() => {
    let result = 0;
    if (totalItems && firstItemIndex !== null) {
      result =
        foundMessageIndex >= 0
          ? foundMessageIndex
          : firstItemIndex + totalItems - 1;
    }
    return result;
  }, [foundMessageIndex, totalItems, firstItemIndex]);

  // const websocketsClient = useWebsockets();

  // React.useEffect(() => {
  //   if (!websocketsClient) return;

  //   const channel = websocketsClient.channels.get(getChannelId());

  //   // const invalidate = ((data, msg) => {
  //   //   console.log({ data, msg });
  //   //   void utils.messages.get.invalidate();
  //   // }) satisfies Parameters<typeof subscribeWs>[2];

  //   const unsubs = [
  //     subscribeWs(channel, "messages:create", (data) => {
  //       utils.messages.get.setInfiniteData(
  //         messagesQueryKeyRef.current,
  //         (queryData) => {
  //           if (!queryData || !queryData.pages.length) return queryData;

  //           let updatedPages = [...queryData.pages];
  //           const newMessage = {
  //             ...data,
  //             created_at: new Date(data.created_at),
  //             updated_at: new Date(data.updated_at),
  //             id: BigInt(data.id),
  //           };
  //           const lastPage = updatedPages[updatedPages.length - 1];
  //           const lastMessage = lastPage.items[lastPage.items.length - 1];
  //           const shouldCreateNewPage = lastPage.items.length >= PER_PAGE;

  //           if (shouldCreateNewPage) {
  //             updatedPages.push({
  //               items: [newMessage],
  //               returnedDirection: "forward",
  //             });
  //             let updatedPageParams = [...queryData.pageParams];
  //             updatedPageParams.push({
  //               id: lastMessage.id,
  //               direction: "forward",
  //             });

  //             return {
  //               ...queryData,
  //               pages: updatedPages,
  //               pageParams: updatedPageParams,
  //             };
  //           } else {
  //             updatedPages[updatedPages.length - 1] = {
  //               ...updatedPages[updatedPages.length - 1],
  //               items: [
  //                 ...updatedPages[updatedPages.length - 1].items,
  //                 newMessage,
  //               ],
  //             };

  //             return { ...queryData, pages: updatedPages };
  //           }
  //         }
  //       );
  //     }),
  //   ];

  //   return () => {
  //     unsubs.forEach((u) => u());
  //     void channel.detach();
  //   };
  // }, [websocketsClient]);

  const messagesCreateSpamMutation = trpc.messages.createSpam.useMutation({
    onSuccess: () => {
      utils.messages.get.invalidate();
    },
  });

  const messageCreateMutation = trpc.messages.create.useMutation({
    onSuccess: () => {
      form.reset();
      //utils.messages.get.invalidate();
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
    messageCreateMutation.mutate({ content: values.content });
  };
  const onSearchSubmit: SubmitHandler<SearchFormValues> = (values) => {
    setUrlMessageId(values.text);
  };

  const authDisabled = guestLoginMutation.isPending || user.isFetching;

  const tryLoadOlder = async (ignoreError?: boolean) => {
    if (
      !messages.hasPreviousPage ||
      messages.isFetchingPreviousPage ||
      (ignoreError ? false : messages.isFetchPreviousPageError)
    ) {
      return;
    }

    const res = await messages.fetchPreviousPage({ cancelRefetch: false });
    if (res.isFetchPreviousPageError) return;

    const prependedCount = res.data?.pages?.[0]?.items.length || 0;
    if (prependedCount) {
      setFirstItemIndex((prev) =>
        prev !== null ? prev - prependedCount : prev
      );
    }

    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      let data = queryData;
      if (!data) return data;

      const totalPages = data.pages.length;
      const isFirstPageEmpty = totalPages > 1 && !data.pages[0].items.length;
      if (isFirstPageEmpty) {
        data = {
          ...data,
          pageParams: [null, ...data?.pageParams.slice(1)],
        };
      }

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

  console.log({ ...messages.data });

  const tryLoadNewer = async (ignoreError?: boolean) => {
    if (
      !messages.hasNextPage ||
      messages.isFetchingNextPage ||
      (ignoreError ? false : messages.isFetchNextPageError)
    ) {
      return;
    }

    const res = await messages.fetchNextPage({ cancelRefetch: false });
    if (res.isFetchNextPageError) return;

    utils.messages.get.setInfiniteData(messagesQueryKey, (queryData) => {
      let data = queryData;
      if (!data) return data;

      const totalPages = data.pages.length;
      const isLastPageEmpty =
        totalPages > 1 && !data.pages[totalPages - 1].items.length;
      if (isLastPageEmpty) {
        data = {
          ...data,
          pageParams: [...data?.pageParams.slice(0, totalPages - 1), null],
        };
      }
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
      if (![0, 1].includes(pageIndexDiff)) {
        return;
      }

      let lowestPageIndex = visibleStartIndexBelongsToPageIndex;
      let highestPageIndex = visibleEndIndexBelongsToPageIndex;
      let includedPageIndexes = new Set([lowestPageIndex, highestPageIndex]);
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
      console.log("end");
    }
  };

  const retryInvalidate = () => {
    if (!messages.isError || messages.isFetching) {
      return;
    }

    setUrlMessageId();
  };

  React.useEffect(() => {
    if (isPolling) {
      trimPagesAroundViewport();
    }
  }, [isPolling]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (
      messages.isSuccess &&
      messages.data?.pageParams.length === 1 &&
      messages.data.pageParams[0] &&
      !totalItems
    ) {
      // in case we have no items and invalid page param, reset
      utils.messages.get.setInfiniteData(messagesQueryKey, (data) => {
        if (!data) return data;
        return {
          ...data,
          pageParams: [null],
        };
      });
    }
    // eslint-disable-next-line
  }, [
    messages.isSuccess,
    messages.dataUpdatedAt,
    totalItems,
    messagesQueryKey,
  ]);

  React.useEffect(() => {
    if (!router.isReady) return;

    setQueryInitializing(true);
    setIsScrollToMessageDone(false);
    setIsMessageHighlightConsumed(false);
  }, [router]);

  React.useEffect(() => {
    if (!queryInitializing) return;

    const run = async () => {
      if (foundMessageIndex >= 0) {
        virtuosoRef.current?.scrollToIndex({
          index: foundMessageIndex,
          align: "center",
          behavior: "smooth",
        });
      } else {
        await utils.messages.get.invalidate();
        setMessagesQueryKey((prev) => ({
          ...prev,
          around: urlMessageId || undefined,
        }));
      }

      setQueryInitializing(false);
    };
    run();
  }, [queryInitializing]);

  React.useEffect(() => {
    if (
      queryInitializing !== false ||
      isScrollToMessageDone ||
      !urlMessageId ||
      !messages.data?.items.length
    ) {
      return;
    }

    if (foundMessageIndex < 0) {
      addAppSnackbar({
        message: `Message with ID ${urlMessageId} not found.`,
        variant: "error",
      });
    }
    setIsScrollToMessageDone(true);
  }, [isScrollToMessageDone, messages.data?.items, queryInitializing]);

  return (
    <div className="flex-1 flex flex-col mt-3">
      <HorizontalStack addClassName="flex-1">
        <Paper
          elevation={1}
          className={clsx(
            `${defaultPadding} flex flex-1 flex-col max-w-2xs max-md:hidden rounded-none ring ring-[var(--mui-palette-divider)]`
          )}
        >
          <HorizontalStack addClassName="justify-between items-center">
            <Typography>Some text</Typography>

            <Tooltip title="List of channels">
              <IconButton>
                <ViewListIcon />
              </IconButton>
            </Tooltip>
          </HorizontalStack>
        </Paper>
        <Paper
          elevation={1}
          className={clsx(
            `flex flex-1 flex-col rounded-none ring ring-[var(--mui-palette-divider)]`
          )}
        >
          <HorizontalStack addClassName="justify-between items-center">
            <Typography>Some text</Typography>
            <Button
              variant="outlined"
              onClick={() => {
                setIsPolling(!isPolling);
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
          <div className="w-full flex flex-col flex-1">
            <div className="flex-1">
              {shouldRenderList && initialTopMostItemIndex !== -1 ? (
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
                    bottom: 150,
                    top: 150,
                  }}
                  alignToBottom
                  followOutput={
                    messages.data?.items.length && !messages.hasNextPage
                      ? (isAtBottom) => {
                          return isAtBottom ? "smooth" : false;
                        }
                      : undefined
                  }
                  defaultItemHeight={80}
                  rangeChanged={async (range) => {
                    visibleRangeRef.current = {
                      visibleStartIndex: range.startIndex,
                      visibleEndIndex: range.endIndex,
                    };
                    const localVisibleStartIndex = Math.max(
                      0,
                      range.startIndex - firstItemIndex
                    );
                    const localVisibleEndIndex = Math.max(
                      0,
                      range.endIndex - firstItemIndex
                    );

                    if (localVisibleStartIndex <= PREFETCH_ITEMS) {
                      await tryLoadOlder();
                    }
                    if (
                      localVisibleEndIndex >=
                      totalItems - 1 - PREFETCH_ITEMS
                    ) {
                      await tryLoadNewer();
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
                          isMessageHighlightConsumed
                            ? false
                            : urlMessageId === String(comment.id)
                        }
                        onHighlightConsumed={setIsMessageHighlightConsumed}
                      />
                    );
                  }}
                  components={{
                    Header: () => {
                      if (messages.isFetchingPreviousPage) {
                        return (
                          <div className="p-4 bg-amber-400">Loading...</div>
                        );
                      }
                      if (messages.isFetchPreviousPageError) {
                        return (
                          <VerticalStack>
                            <Typography>
                              Failed to load older messages
                            </Typography>
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
                      return null;
                    },
                    Footer: () => {
                      if (messages.isFetchingNextPage) {
                        return (
                          <div className="p-4 bg-amber-400">Loading...</div>
                        );
                      }

                      if (messages.isFetchNextPageError) {
                        return (
                          <VerticalStack>
                            <Typography>
                              Failed to load newer messages
                            </Typography>
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
                      return null;
                    },
                  }}
                />
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
                        commentDeleteAllMutation.mutate();
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
                          <HorizontalStack
                            wrap={false}
                            addClassName="self-start"
                          >
                            <Tooltip title="Add emoji">
                              <IconButton
                                type="button"
                                onClick={() => {
                                  messagesCreateSpamMutation.mutate({
                                    isBulk: false,
                                    count: 200,
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
              <HorizontalStack addClassName="p-2 bg-[var(--mui-palette-FilledInput-bg)] justify-center">
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
            )}
          </div>
        </Paper>
      </HorizontalStack>
    </div>
  );
};

HomePage.disablePadding = true;

export const getStaticProps = (async () => {
  const helpers = await serverUtils.prepareDefaultData();
  // await helpers.messages.get.prefetch();
  return {
    props: {
      trpcState: helpers.dehydrate(),
    },
    revalidate: CACHE_TIME.QUICKEST,
  };
}) satisfies GetStaticProps;

export default HomePage;
