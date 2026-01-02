import React from "react";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const events = ["unusedEvent"] as const satisfies readonly string[];
export type EventNames = (typeof events)[number];

export type EventInfo = {
  wasHandled: boolean;
  happenedAtMs: number | null;
};

export type EventTypes = Record<EventNames, EventInfo>;

export type MiscState = {
  events: EventTypes;
};

const initialEvents = events.reduce(
  (result, curr) => ({
    ...result,
    [curr]: { wasHandled: false, happenedAtMs: null } satisfies EventInfo,
  }),
  {} as EventTypes
);

const initialState: MiscState = {
  events: initialEvents,
};

export const miscSlice = createSlice({
  name: "misc",
  initialState,
  reducers: {
    eventHappened: {
      reducer: (
        state,
        action: PayloadAction<
          EventNames,
          string,
          { options?: Partial<EventInfo> }
        >
      ) => {
        state.events[action.payload] = {
          happenedAtMs: action.meta.options?.happenedAtMs ?? Date.now(),
          wasHandled: action.meta.options?.wasHandled ?? false,
        };
      },
      prepare: (eventName: EventNames, options?: Partial<EventInfo>) => ({
        payload: eventName,
        meta: { options },
      }),
    },

    eventHandled: (state, action: PayloadAction<EventNames>) => {
      state.events[action.payload] = {
        ...state.events[action.payload],
        wasHandled: true,
      };
    },
  },
});

export const { eventHandled, eventHappened } = miscSlice.actions;

export default miscSlice.reducer;
