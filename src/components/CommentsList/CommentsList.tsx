import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";

import { trpc, type RouterOutput } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import Button from "@/components/Button/Button";
import clsx from "clsx";

type MessageUpdateMutationOptions = NonNullable<
  Parameters<typeof trpc.messages.update.useMutation>[0]
>;
type MessageDeleteMutationOptions = NonNullable<
  Parameters<typeof trpc.messages.delete.useMutation>[0]
>;

export type RenderedMessage =
  RouterOutput["messages"]["get"]["items"][number] & {
    isOptimistic?: true;
    isFailed?: true;
  };

type CommentProps = {
  comment: RenderedMessage;
  shouldHighlight?: boolean;
  onHighlightConsumed?: () => void;
  onUpdateSuccess: MessageUpdateMutationOptions["onSuccess"];
  onDeleteSuccess: MessageDeleteMutationOptions["onSuccess"];
  onOptimisticRetry?: (m: RenderedMessage) => void;
  onOptimisticDelete?: (m: RenderedMessage) => void;
};

export const Comment = ({
  comment,
  shouldHighlight,
  onHighlightConsumed,
  onUpdateSuccess,
  onDeleteSuccess,
  onOptimisticRetry,
  onOptimisticDelete,
}: CommentProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [editInfo, setEditInfo] = useState(comment);

  const commentsDeleteMutation = trpc.messages.delete.useMutation({
    onSuccess: onDeleteSuccess,
  });

  const commentUpdateMutation = trpc.messages.update.useMutation({
    onSuccess: (...args) => {
      setIsEdit(false);
      onUpdateSuccess?.(...args);
    },
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (shouldHighlight && el) {
      el.classList.remove("hash-flash");
      void el.offsetWidth;
      el.classList.add("hash-flash");

      onHighlightConsumed?.();
    }

    // eslint-disable-next-line
  }, [shouldHighlight]);

  return (
    <div ref={ref} className={clsx("p-2 flex flex-wrap gap-3")}>
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
                channelId: editInfo.channel_id,
              });
            }}
            disabled={commentUpdateMutation.isPending}
          >
            Save
          </Button>
        </>
      ) : (
        <>
          <h6 className="word-break-word text-red-500">
            {comment.deleted_at
              ? "(Deleted)"
              : comment.isOptimistic
                ? "PENDING"
                : ""}
          </h6>
          <h6 className="word-break-word">{comment.id}</h6>
          <h5 className="word-break-word">{comment.content}</h5>
          {comment.isFailed ? (
            <>
              <h6 className="word-break-word text-red-500">Failed. Retry?</h6>
              <Button
                variant="outlined"
                onClick={() => {
                  onOptimisticRetry?.(comment);
                }}
              >
                Retry optimistic
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  onOptimisticDelete?.(comment);
                }}
              >
                Delete optimistic
              </Button>
            </>
          ) : null}
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
