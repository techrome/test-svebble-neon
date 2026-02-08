import React, { useEffect } from "react";
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

import { utils as serverUtils } from "@/server";
import { trpc } from "@/trpc";
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

const searchSchemaForm = z.object({
  text: Text.Long(),
});

type SearchFormValues = z.infer<typeof searchSchemaForm>;

const BASE_INDEX = 1_000_000_000;
const PER_PAGE = 20;
const MAX_PAGES = 5;

const hasScrollbar = (el: HTMLElement | null | Window | undefined) =>
  el instanceof HTMLElement ? el.scrollHeight - el.clientHeight > 1 : false;

const HomePage: AppPage = () => {
  const localModal = useLocalModal();
  const { closeModal, openModal } = useGlobalModal();
  const localDrawer = useLocalDrawer();
  const { openDrawer, closeDrawer } = useGlobalDrawer();
  const { addAppSnackbar, dismissAllAppSnackbars } = useAppSnackbar();
  const messageListRef = React.useRef<HTMLElement | null | Window | undefined>(
    undefined
  );
  const messageListRefSetter = React.useCallback(
    (el: HTMLElement | null | Window) => {
      messageListRef.current = el;
    },
    []
  );

  const user = useUser();
  const authModal = useAuthModal();
  const qc = useQueryClient();
  const utils = trpc.useUtils();

  const schema = React.useMemo(
    () => makeMessageCreateSchemaForm(user.data?.user?.emailVerified),
    [user.data?.user?.emailVerified]
  );
  const form = useForm<MessageCreateFormValues>({
    defaultValues: { content: "" },
    resolver: zodResolver(schema),
  });

  const searchForm = useForm<SearchFormValues>({
    defaultValues: { text: "" },
    resolver: zodResolver(searchSchemaForm),
  });

  const virtuosoRef = React.useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [isPolling, setIsPolling] = React.useState(true);
  const [messagesQueryKey, setMessagesQueryKey] = React.useState({
    limit: PER_PAGE,
    // around: "4523",
  });

  const messages = useAppQuery(
    trpc.messages.get.useInfiniteQuery(messagesQueryKey, {
      initialCursor: { around: "4523" },
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

  const messagesCreateSpamMutation = trpc.messages.createSpam.useMutation({
    onSuccess: () => {
      utils.messages.get.invalidate();
    },
  });

  const messageCreateMutation = trpc.messages.create.useMutation({
    onSuccess: () => {
      form.reset();
      utils.messages.get.invalidate();
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

  const onSubmit: SubmitHandler<MessageCreateFormValues> = (values) => {
    messageCreateMutation.mutate({ content: values.content });
  };
  const onSearchSubmit: SubmitHandler<SearchFormValues> = (values) => {};

  const authDisabled = guestLoginMutation.isPending || user.isFetching;

  const tryLoadOlder = React.useCallback(
    async (ignoreError?: boolean) => {
      if (
        !messages.hasPreviousPage ||
        messages.isFetchingPreviousPage ||
        (ignoreError ? false : messages.isFetchPreviousPageError)
      ) {
        return;
      }

      const res = await messages.fetchPreviousPage();
      if (res.isFetchPreviousPageError) return;

      if (res.data?.pages.length) {
        setFirstItemIndex((prev) =>
          prev !== null ? prev - res.data.pages[0].items.length : prev
        );
      }

      utils.messages.get.setInfiniteData(messagesQueryKey, (oldData) => {
        let data = oldData;
        const totalPages = data?.pages?.length;
        if (
          totalPages &&
          totalPages > 1 &&
          data &&
          !data.pages[0].items.length
        ) {
          data = {
            ...data,
            pages: data?.pages.slice(1),
            pageParams: data?.pageParams.slice(1),
          };
        }
        if (!data || !totalPages || totalPages <= MAX_PAGES || !isPolling)
          return data;

        const cutoff = MAX_PAGES;
        return {
          ...data,
          pageParams: data.pageParams.slice(0, cutoff),
          pages: data.pages.slice(0, cutoff),
        };
      });
    },
    [messages, utils, messagesQueryKey, isPolling]
  );
  //console.log({ firstItemIndex });
  console.log({ ...messages.data });

  // const newestItemReachedRef = React.useRef(false)
  // const oldestItemReachedRef = React.useRef(false)

  const tryLoadNewer = React.useCallback(
    async (ignoreError?: boolean) => {
      if (
        !messages.hasNextPage ||
        messages.isFetchingNextPage ||
        (ignoreError ? false : messages.isFetchNextPageError)
      ) {
        return;
      }
      const res = await messages.fetchNextPage();
      if (res.isFetchNextPageError) return;

      utils.messages.get.setInfiniteData(messagesQueryKey, (oldData) => {
        let data = oldData;
        const totalPages = data?.pages?.length;
        if (
          totalPages &&
          totalPages > 1 &&
          data &&
          !data.pages[totalPages - 1].items.length
        ) {
          data = {
            ...data,
            pages: data?.pages.slice(0, totalPages - 1),
            pageParams: data?.pageParams.slice(0, totalPages - 1),
          };
        }
        if (!data || !totalPages || totalPages <= MAX_PAGES || !isPolling)
          return data;

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
    },
    [messages, utils, messagesQueryKey, isPolling]
  );

  const retryInvalidate = React.useCallback(() => {
    if (!messages.isError || messages.isFetching) {
      return;
    }

    utils.messages.get.invalidate();
  }, [messages, utils]);

  const shouldRenderList =
    Boolean(messages.data?.items.length) && firstItemIndex !== null;

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (shouldRenderList && !hasScrollbar(messageListRef.current)) {
        if (messages.hasPreviousPage) {
          void tryLoadOlder();
          return;
        }

        if (messages.hasNextPage) {
          void tryLoadNewer();
        }
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [messages.dataUpdatedAt]);

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

  // React.useLayoutEffect(() => {
  //   if (!atBottom || !messages.data?.items.length || messages.hasNextPage) {
  //     return;
  //   }

  //   const lastIndex = (messages.data?.items.length ?? 0) - 1;
  //   if (lastIndex < 0) return;

  //   requestAnimationFrame(() => {
  //     requestAnimationFrame(() => {
  //       console.log({ lastIndex });
  //         virtuosoRef.current?.scrollToIndex({
  //           index: lastIndex,
  //           align: "end",
  //           behavior: "auto", // <- tiny snap to guarantee last item
  //         });
  //     });
  //   });
  // }, [atBottom, messages.hasNextPage, messages.data?.items.length]);

  const initialTopMostItemIndex =
    totalItems && firstItemIndex !== null ? firstItemIndex + totalItems - 1 : 0;
  //console.log({ firstItemIndex });

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
              {shouldRenderList ? (
                <Virtuoso
                  // ref={virtuosoRef}
                  scrollerRef={messageListRefSetter}
                  className="h-full"
                  firstItemIndex={firstItemIndex}
                  initialTopMostItemIndex={initialTopMostItemIndex}
                  alignToBottom
                  followOutput={
                    messages.data?.items.length && !messages.hasNextPage
                      ? (isAtBottom) => {
                          return isAtBottom ? "smooth" : false;
                        }
                      : undefined
                  }
                  atTopStateChange={(atTop) => {
                    if (atTop) tryLoadOlder();
                  }}
                  atBottomStateChange={(atBottom) => {
                    //console.log({ atBottom });
                    if (atBottom) tryLoadNewer();
                  }}
                  endReached={() => {
                    //console.log("end reached");
                    tryLoadNewer();
                  }}
                  startReached={() => {
                    //console.log("start reached");
                    tryLoadOlder();
                  }}
                  atTopThreshold={300}
                  atBottomThreshold={300}
                  data={messages.data?.items}
                  computeItemKey={(_, item) => String(item.id)}
                  itemContent={(_, comment) => {
                    return <Comment comment={comment} />;
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
                    Retry
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
