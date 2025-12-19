import React from "react";
import Button from "@/components/Button/Button";
import { Virtuoso } from "react-virtuoso";

import { trpc } from "@/trpc/client";
import useAppQuery from "@/utils/useAppQuery";
import { RouterOutput } from "@/trpc/client";

type CommentProps = {
  comment: RouterOutput["commentsGet"][number];
};

const Comment = ({ comment }: CommentProps) => {
  const [isEdit, setIsEdit] = React.useState(false);
  const [editInfo, setEditInfo] = React.useState(comment);

  const utils = trpc.useUtils();

  const commentsDeleteMutation = trpc.commentDelete.useMutation({
    onSuccess: () => {
      utils.commentsGet.invalidate();
    },
  });

  const commentUpdateMutation = trpc.commentUpdate.useMutation({
    onSuccess: () => {
      setIsEdit(false);
      utils.commentsGet.invalidate();
    },
  });

  return (
    <div key={comment.id} className="mt-2 flex flex-wrap gap-3">
      {isEdit ? (
        <>
          <input
            className="border block p-3 w-52"
            value={editInfo.text}
            onChange={(e) => {
              setEditInfo((prev) => ({
                ...prev,
                text: e.target.value,
              }));
            }}
          />
          <Button
            variant="outlined"
            onClick={() => {
              commentUpdateMutation.mutate(editInfo);
            }}
            disabled={commentUpdateMutation.isPending}
          >
            Save
          </Button>
        </>
      ) : (
        <>
          <h5 className="word-break-word">{comment.text}</h5>

          <Button
            variant="outlined"
            onClick={() => {
              setEditInfo(comment);
              setIsEdit(true);
            }}
          >
            Edit
          </Button>
        </>
      )}

      {isEdit ? (
        <Button
          variant="outlined"
          onClick={() => {
            setEditInfo(comment);
            setIsEdit(false);
          }}
        >
          Cancel
        </Button>
      ) : (
        <Button
          variant="outlined"
          onClick={() => {
            commentsDeleteMutation.mutate({ id: comment.id });
          }}
          disabled={commentsDeleteMutation.isPending}
        >
          Delete
        </Button>
      )}
    </div>
  );
};

const CommentsList = () => {
  const comments = useAppQuery(
    trpc.commentsGet.useQuery(undefined, { staleTime: 15000 })
  );
  return (
    <div className="mt-5 w-full">
      {comments.status !== "success" ? (
        <h5>Loading comments...</h5>
      ) : (
        <Virtuoso
          useWindowScroll
          //style={{ height: "500px" }}
          data={comments.data}
          itemContent={(_, comment) => {
            return <Comment comment={comment} />;
          }}
        />
      )}
    </div>
  );
};

export default CommentsList;
