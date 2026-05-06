import type { RealtimeChannel, Message as AblyMessage } from "ably";

import type { ToSerializable } from "@/utils/types";
import {
  FullMessage,
  MessagesGetOutput,
} from "../../server/trpc/routers/messages";

type Message = MessagesGetOutput["items"][number] &
  Partial<Pick<FullMessage, "content_text">>;
export type MessageSerializable = ToSerializable<Message>;

type BaseMessageKeys = keyof Pick<
  Message,
  "id" | "reply_count" | "content" | "edited_at"
>;
type BaseMessageAdditionalKeys = keyof Pick<Message, "content_text">;

export type MessageBase = Record<BaseMessageKeys, unknown> &
  Partial<Record<BaseMessageAdditionalKeys, unknown>>;

type ParentMessage<TFull extends MessageBase> = Pick<
  TFull,
  "id" | "reply_count"
>;

export type MessageMutationResponse<
  TFull extends MessageBase,
  TMessage,
  THasParentUpdate extends boolean = true,
> = {
  message: TMessage;
  messagesVersion: TFull["id"]; // numeric id
} & (THasParentUpdate extends true
  ? { parentMessageUpdate: ParentMessage<TFull> | null }
  : { parentMessageUpdate?: never });

type WebsocketEventsOf<TFull extends MessageBase> = {
  "messages:create": MessageMutationResponse<TFull, TFull>;
  "messages:update": MessageMutationResponse<
    TFull,
    Omit<
      Pick<
        TFull,
        "content_text" | "content" | "id" | "edited_at" | "reply_count"
      >,
      "content_text"
    > & {
      content_text: NonNullable<TFull["content_text"]>;
    },
    false
  >;
  "messages:delete": MessageMutationResponse<TFull, Pick<TFull, "id">>;
};

export type WebsocketEventsOriginal = WebsocketEventsOf<Message>;
export type WebsocketEvents = WebsocketEventsOf<MessageSerializable>;

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
  handler: (data: WebsocketPayload<EventName>, msg: AblyMessage) => void
) => {
  const listener = (msg: AblyMessage) => {
    handler(msg.data as WebsocketPayload<EventName>, msg);
  };

  channel.subscribe(eventName, listener);
  return () => channel.unsubscribe(eventName, listener);
};
