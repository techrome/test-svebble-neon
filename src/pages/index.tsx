import React from "react";
import { type GetStaticProps } from "next";
import Button from "@mui/material/Button";
import clsx from "clsx";

import { trpc } from "@/trpc/client";
import useMyQuery from "@/utils/useMyQuery";
import { prepareDefaultData } from "@/utils/prepareDefaultData";
import CommentsList from "@/components/CommentsList/CommentsList";
import { useColorScheme } from "@mui/material/styles";
import Link from "@/components/Link/Link";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import { Box } from "@mui/material";
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
import { setModalState } from "@/redux/slices/overlays";

const GlobalData = () => {
  const globalData = useMyQuery(
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
        className="pt-2 flex gap-3 sticky under-navbar-1 flex-wrap"
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
  const { mode, setMode } = useColorScheme();
  const dispatch = useAppDispatch();
  const modalState = useAppSelector((state) => state.overlays.modal);

  return (
    <div>
      <h1>Hi</h1>
      <div className="flex gap-3 flex-wrap">
        <Button
          variant="outlined"
          onClick={() => {
            setMode(mode === "light" ? "dark" : "light");
          }}
        >
          Toggle color mode
        </Button>
        <Button variant="contained">Test</Button>
        <Link href="/about">
          <Button variant="contained" color="secondary">
            About page
          </Button>
        </Link>
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            dispatch(
              setModalState({ content: Math.random(), isOpen: true, props: {} })
            );
          }}
        >
          {modalState.content}
        </Button>
        <Button variant="contained" color="info">
          Info
        </Button>
        <Button variant="contained" color="warning">
          Warning
        </Button>
        <Button variant="contained" color="success">
          Success
        </Button>
      </div>
      <div className="flex gap-4 mt-4">
        <LoadingBoundary>
          <GlobalData />
        </LoadingBoundary>
      </div>

      <LoadingBoundary>
        <Comments />
      </LoadingBoundary>
    </div>
  );
};

export const getStaticProps = (async () => {
  const helpers = await prepareDefaultData();
  await helpers.commentsGet.prefetch();
  return {
    props: {
      trpcState: helpers.dehydrate(),
    },
    revalidate: 15,
  };
}) satisfies GetStaticProps;

export default HomePage;
