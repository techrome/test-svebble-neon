import React from "react";
import Button from "@mui/material/Button";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";

import { trpc } from "@/trpc/client";
import useMyQuery from "@/utils/useMyQuery";

type CommentProps = {
  comment: {
    text: string;
    id: string;
  };
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
    <div key={comment.id} className="mt-2 flex gap-3">
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
          <h5>{comment.text}</h5>

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
  const comments = useMyQuery(
    trpc.commentsGet.useQuery(undefined, { staleTime: 15000 })
  );
  return (
    <div className="mt-5 w-full h-[500px]">
      {comments.status !== "success" ? (
        <h5>Loading comments...</h5>
      ) : (
        <AutoSizer>
          {({ height, width }) => (
            <FixedSizeList
              className="list"
              itemData={comments.data}
              height={height}
              width={width}
              itemCount={comments.data.length}
              itemSize={60}
              itemKey={(index, data) => {
                return data[index].id;
              }}
            >
              {({ data, index, style }) => {
                const comment = data[index];
                return (
                  <div style={style} key={comment.id}>
                    <Comment comment={comment} />
                  </div>
                );
              }}
            </FixedSizeList>
          )}
        </AutoSizer>
      )}
    </div>
  );
};

export default CommentsList;
