import React from "react";
import { type GetStaticProps } from "next";
import Button from "@/components/Button/Button";
import clsx from "clsx";

import { utils } from "@/server";
import { trpc } from "@/trpc";
import useAppQuery from "@/utils/useAppQuery";
import CommentsList from "@/components/CommentsList/CommentsList";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import { Box } from "@mui/material";
import {
  useGlobalDrawer,
  useGlobalModal,
  useLocalDrawer,
  useLocalModal,
} from "@/utils/useOverlay";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import { useAppSnackbar } from "@/utils/snackbar";
import { CACHE_TIME } from "@/utils/cacheTime";

const GlobalData = () => {
  const globalData = useAppQuery(
    trpc.globalData.useQuery(undefined, { staleTime: 30000 })
  );

  if (globalData.status !== "success") {
    return <div>Loading...</div>;
  }

  return (
    <div className={clsx("p-4", "border")}>
      <h1>{globalData.data.links.join(", ")}</h1>
      <em>
        Global created at {new Date(globalData.dataUpdatedAt).toISOString()}
      </em>
      <h2>Raw data:</h2>
      <pre>{JSON.stringify(globalData.data, null, 4)}</pre>
    </div>
  );
};

const Comments = () => {
  const [newComment, setNewComment] = React.useState("");

  const utils = trpc.useUtils();

  const commentCreateSpamMutation = trpc.commentCreateSpam.useMutation({
    onSuccess: () => {
      utils.commentsGet.invalidate();
    },
  });

  const commentCreateMutation = trpc.commentCreate.useMutation({
    onSuccess: () => {
      setNewComment("");
      utils.commentsGet.invalidate();
    },
  });

  const commentDeleteAllMutation = trpc.commentsDeleteAll.useMutation({
    onSuccess: () => {
      utils.commentsGet.invalidate();
    },
  });

  return (
    <div>
      <div className="mb-5">
        <Button
          variant="outlined"
          onClick={() => {
            commentDeleteAllMutation.mutate();
          }}
          disabled={commentDeleteAllMutation.isPending}
        >
          Delete All Comments
        </Button>
      </div>
      <Box
        className="pt-2 flex gap-3 sticky under-navbar flex-wrap"
        sx={{
          backgroundColor: (theme) => theme.vars?.palette.background.default,
        }}
      >
        <input
          className="border block p-3 w-52"
          value={newComment}
          onChange={(e) => {
            setNewComment(e.target.value);
          }}
        />
        <Button
          variant="outlined"
          onClick={() => {
            commentCreateMutation.mutate({ text: newComment });
          }}
          disabled={commentCreateMutation.isPending}
        >
          Add Comment
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            commentCreateSpamMutation.mutate({ isBulk: true });
          }}
          disabled={commentCreateSpamMutation.isPending}
        >
          Add Spam Comments In Bulk
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            commentCreateSpamMutation.mutate();
          }}
          disabled={commentCreateSpamMutation.isPending}
        >
          Add Spam Comments One By One
        </Button>
      </Box>

      <LoadingBoundary>
        <CommentsList />
      </LoadingBoundary>
    </div>
  );
};

const HomePage = () => {
  const localModal = useLocalModal();
  const { closeModal, openModal } = useGlobalModal();
  const localDrawer = useLocalDrawer();
  const { openDrawer, closeDrawer } = useGlobalDrawer();
  const { addAppSnackbar, dismissAllAppSnackbars } = useAppSnackbar();

  return (
    <VerticalStack>
      <h1>Hi</h1>
      <HorizontalStack>
        <Button
          variant="outlined"
          onClick={() => {
            addAppSnackbar({
              message: "Notification message",
              details:
                "asdhkasdkahsd hasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhdddd",
              persist: true,
              durationMs: 5000,
            });
          }}
        >
          Show info
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            addAppSnackbar({
              message: "Notification message",
              variant: "error",
              // details: "Ok",
              durationMs: 0,
            });
          }}
        >
          Show error
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            (["info", "warning", "success", "error"] as const).forEach(
              (variant) => {
                addAppSnackbar({
                  message: "Notification message",
                  variant: variant,
                  details:
                    "asdhkasdkahsd hasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhddddhasjkdhasjkhdjakshdjksahdjahsdjhasjdhjsahdasdsdajdhasjdhajdhajsdhajsdhjasdhjasddhdddd",
                  durationMs: 120000,
                });
              }
            );
          }}
        >
          All colors
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            dismissAllAppSnackbars();
          }}
        >
          Clear snackbars
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            localModal.openModal();
          }}
        >
          Open local modal
        </Button>
        <localModal.ReadyComponent title="Authentication">
          <Button
            variant="contained"
            color="info"
            onClick={localModal.closeModal}
          >
            OK
          </Button>
        </localModal.ReadyComponent>
        <Button
          variant="contained"
          color="info"
          onClick={() => {
            openModal({
              content: (
                <Button variant="contained" color="info" onClick={closeModal}>
                  OK
                </Button>
              ),
              props: { title: "Test" },
            });
          }}
        >
          Open global modal
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => {
            localDrawer.openDrawer();
          }}
        >
          Open local drawer
        </Button>
        <localDrawer.Drawer
          isOpen={localDrawer.isOpen}
          onClose={localDrawer.closeDrawer}
          title="Authentication"
        >
          <Button
            variant="contained"
            color="info"
            onClick={localDrawer.closeDrawer}
          >
            OK local
          </Button>
        </localDrawer.Drawer>
        <Button
          variant="contained"
          color="success"
          onClick={() => {
            openDrawer({
              content: (
                <Button variant="contained" color="info" onClick={closeDrawer}>
                  OK
                </Button>
              ),
              props: { title: "Test" },
            });
          }}
        >
          Open global drawer
        </Button>
      </HorizontalStack>

      <LoadingBoundary>
        <GlobalData />
      </LoadingBoundary>

      <LoadingBoundary>
        <Comments />
      </LoadingBoundary>
    </VerticalStack>
  );
};

export const getStaticProps = (async () => {
  const helpers = await utils.prepareDefaultData();
  await helpers.commentsGet.prefetch();
  return {
    props: {
      trpcState: helpers.dehydrate(),
    },
    revalidate: CACHE_TIME.QUICKEST,
  };
}) satisfies GetStaticProps;

export default HomePage;
