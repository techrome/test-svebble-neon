import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const getReactionKey = (id: number) => `reaction-${id}`;

export type MessageReactionsUIState = {
  pendingReactions: Partial<
    Record<
      string,
      Partial<Record<string, { shouldReact: boolean; reactionId: number }>>
    >
  >;
};

const initialState: MessageReactionsUIState = {
  pendingReactions: {},
};

export const messageReactionsUISlice = createSlice({
  name: "messageReactionsUI",
  initialState,
  reducers: {
    setPendingReaction: (
      state,
      action: PayloadAction<{
        messageId: number;
        reactionId: number;
        isPending: boolean;
        shouldReact: boolean;
      }>
    ) => {
      const { messageId, reactionId, isPending, shouldReact } = action.payload;
      const reactionKey = getReactionKey(reactionId);

      if (isPending) {
        if (state.pendingReactions[messageId]) {
          state.pendingReactions[messageId][reactionKey] = {
            shouldReact,
            reactionId,
          };
        } else {
          state.pendingReactions[messageId] = {
            [reactionKey]: { shouldReact, reactionId },
          };
        }
      } else {
        if (state.pendingReactions[messageId]) {
          delete state.pendingReactions[messageId][reactionKey];

          if (Object.keys(state.pendingReactions[messageId]).length === 0) {
            delete state.pendingReactions[messageId];
          }
        }
      }
    },
    deleteAllPendingMessageReactions: (
      state,
      action: PayloadAction<{
        messageId: number;
      }>
    ) => {
      const { messageId } = action.payload;

      delete state.pendingReactions[messageId];
    },
  },
});

export const { setPendingReaction, deleteAllPendingMessageReactions } =
  messageReactionsUISlice.actions;

export default messageReactionsUISlice.reducer;
