import React from "react";
import { Virtuoso } from "react-virtuoso";

import { trpc, type RouterOutput } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import Button from "@/components/Button/Button";

type CommentProps = {
  comment: RouterOutput["messages"]["get"]["items"][number];
};

export const Comment = ({ comment }: CommentProps) => {
  const [isEdit, setIsEdit] = React.useState(false);
  const [editInfo, setEditInfo] = React.useState(comment);

  const utils = trpc.useUtils();
  const commentsDeleteMutation = trpc.messages.delete.useMutation({
    onSuccess: () => {
      utils.messages.get.invalidate();
    },
  });

  const commentUpdateMutation = trpc.messages.update.useMutation({
    onSuccess: () => {
      setIsEdit(false);
      utils.messages.get.invalidate();
    },
  });

  return (
    <div key={comment.id} className="p-2 flex flex-wrap gap-3">
      {isEdit ? (
        <>
          <input
            className="border block p-3 w-52"
            value={editInfo.content}
            onChange={(e) => {
              setEditInfo((prev) => ({
                ...prev,
                content: e.target.value,
              }));
            }}
          />
          <Button
            variant="outlined"
            onClick={() => {
              commentUpdateMutation.mutate({
                content: editInfo.content,
                id: editInfo.id,
              });
            }}
            disabled={commentUpdateMutation.isPending}
          >
            Save
          </Button>
        </>
      ) : (
        <>
          <h5 className="word-break-word">{comment.content}</h5>

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

// const CommentsList = () => {
//   const comments = useAppQuery(
//     trpc.messages.get.useQuery(undefined, { staleTime: 15000 })
//   );
//   return (
//     <div className="mt-5 w-full">
//       {comments.status !== "success" ? (
//         <h5>Loading comments...</h5>
//       ) : (
//         <Virtuoso
//           useWindowScroll
//           //style={{ height: "500px" }}
//           data={comments.data}
//           itemContent={(_, comment) => {
//             return <Comment comment={comment} />;
//           }}
//         />
//       )}
//     </div>
//   );
// };

// export default CommentsList;
