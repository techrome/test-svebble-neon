import React from "react";
import { GetStaticProps } from "next";
import Button from "@mui/material/Button";
import clsx from "clsx";

import { trpc } from "@/trpc/client";
import useMyQuery from "@/utils/useMyQuery";
import { prepareDefaultData } from "@/utils/prepareDefaultData";
import CommentsList from "@/components/CommentsList/CommentsList";
import { useColorScheme } from "@mui/material/styles";
import Link from "@/components/Link/Link";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";

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
      <div className="flex gap-3">
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
      </div>

      <LoadingBoundary>
        <CommentsList />
      </LoadingBoundary>
    </div>
  );
};

const HomePage = () => {
  const { mode, setMode } = useColorScheme();
  return (
    <div>
      <h1>Hi</h1>
      <div className="flex gap-3">
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
            Test 2
          </Button>
        </Link>
        <Button variant="contained" color="error">
          Error
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
