import { hours } from "@/utils/cacheTime";
import { env } from "../env";
import ably from "ably";

import {
  getChannelId,
  WebsocketEventName,
  WebsocketPayload,
} from "@/trpc/helpers/websockets";
import { isDev } from "@/utils/isDev";

export const ablyRest = env.WEBSOCKETS_API_KEY
  ? new ably.Rest({ key: env.WEBSOCKETS_API_KEY })
  : null;

if (!env.WEBSOCKETS_API_KEY && isDev) {
  console.warn("No WEBSOCKETS_API_KEY provided. Websockets won't work.");
}

export type AblyTokenRequest = ably.TokenRequest;

export const createChannelSubscribeTokenRequest = async (opts: {
  userId: string;
  channelId?: string;
  ttlMs?: number;
}): Promise<AblyTokenRequest | null> => {
  if (!ablyRest) return null;

  const capability = {
    [getChannelId(opts.channelId)]: ["subscribe"],
  } satisfies Record<string, string[]>;

  return ablyRest.auth.createTokenRequest({
    clientId: opts.userId,
    ttl: opts.ttlMs || hours(1),
    capability: JSON.stringify(capability),
  });
};

export const publishChannelEvent = async <
  EventName extends WebsocketEventName,
>(opts: {
  channelId?: string;
  eventName: EventName;
  data: WebsocketPayload<EventName>;
}): Promise<void> => {
  if (!ablyRest) return;

  await ablyRest.channels
    .get(getChannelId(opts.channelId))
    .publish(opts.eventName, opts.data);
};
