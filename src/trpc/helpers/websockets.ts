import type { RealtimeChannel, Message } from "ably";

import { type RouterOutput } from "@/trpc";
import { ToSerializable } from "@/utils/types";

export type MessageSerializable = ToSerializable<
  RouterOutput["messages"]["get"]["items"][number]
>;

type Payload<T> = {
  message: T;
  messagesVersion: string;
};

export type WebsocketEvents = {
  "messages:create": Payload<MessageSerializable>;
  "messages:update": Payload<MessageSerializable>;
  "messages:delete": Payload<{ id: MessageSerializable["id"] }>;
};

export type WebsocketEventName = keyof WebsocketEvents;
export type WebsocketPayload<EventName extends WebsocketEventName> =
  WebsocketEvents[EventName];
export type WebsocketItem = {
  [K in WebsocketEventName]: {
    eventName: K;
    data: WebsocketPayload<K>;
  };
}[WebsocketEventName];

export const getChannelId = (id: string) => `publicChannels:${id}`;

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
