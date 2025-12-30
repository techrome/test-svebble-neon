import React from "react";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const events = [
  "hasLoggedIn",
  "hasSignedUp",
] as const satisfies readonly string[];
type EventNames = (typeof events)[number];

type EventStatus = {
  wasHandled: boolean;
  happenedAtMs: number | null;
};

export type EventTypes = Record<EventNames, EventStatus>;

export type MiscState = {
  events: EventTypes;
};

const initialEvents = events.reduce(
  (result, curr) => ({
    ...result,
    [curr]: { wasHandled: false, happenedAtMs: null } satisfies EventStatus,
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
    eventHappened: (state, action: PayloadAction<EventNames>) => {
      state.events[action.payload] = {
        happenedAtMs: Date.now(),
        wasHandled: false,
      };
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
