import { hours } from "@/utils/cacheTime";
import { env } from "../env";
import ably from "ably";

import {
  getChannelId,
  WebsocketEventName,
  WebsocketPayload,
} from "@/trpc/helpers/websockets";

export const ablyRest = new ably.Rest({ key: env.WEBSOCKETS_API_KEY });

export type AblyTokenRequest = ably.TokenRequest;

export const createChannelSubscribeTokenRequest = async (opts: {
  userId: string;
  channelId?: string;
  ttlMs?: number;
}): Promise<AblyTokenRequest> => {
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
  await ablyRest.channels
    .get(getChannelId(opts.channelId))
    .publish(opts.eventName, opts.data);
};
