import type { RealtimeChannel, Message } from "ably";

import { type RouterOutput } from "@/trpc";
import { ToSerializable } from "@/utils/types";

type MessageSerializable = ToSerializable<
  RouterOutput["messages"]["get"]["items"][number]
>;

type Payload<T> = {
  message: T;
  channelVersion: string;
};

export type WebsocketEvents = {
  "messages:create": Payload<MessageSerializable>;
  "messages:update": Payload<MessageSerializable>;
  "messages:delete": {
    id: Payload<MessageSerializable["id"]>;
  };
};

export type WebsocketEventName = keyof WebsocketEvents;
export type WebsocketPayload<EventName extends WebsocketEventName> =
  WebsocketEvents[EventName];

export const getChannelId = (id: string) => `channel:${id}`;

export const subscribeWs = <EventName extends WebsocketEventName>(
  channel: RealtimeChannel,
  eventName: EventName,
  handler: (data: WebsocketPayload<EventName>, msg: Message) => void
) => {
  const listener = (msg: Message) => {
    handler(msg.data as WebsocketPayload<EventName>, msg);
  };

  channel.subscribe(eventName, listener);
  return () => channel.unsubscribe(eventName, listener);
};
