import { useEffect, useState } from "react";
import type { ClientOptions, ErrorInfo, Realtime } from "ably";
import { BaseRealtime, FetchRequest, WebSocketTransport } from "ably/modular";
import { trpc } from "@/trpc";

const createAblyClient = (opts: {
  authCallback: ClientOptions["authCallback"];
}) => {
  return new BaseRealtime({
    authCallback: opts.authCallback,
    plugins: {
      WebSocketTransport,
      FetchRequest,
    },
  });
};

type Props = {
  channelId: string;
};

export const useWebsockets = (props: Props) => {
  const tokenMutation = trpc.messages.ablyTokenRequest.useMutation();
  const [realtimeClient, setRealtimeClient] = useState<Realtime | null>(null);

  useEffect(() => {
    let ablyClient: BaseRealtime | null = null;
    const run = async () => {
      let initialTokenRequest = await tokenMutation.mutateAsync({
        channelId: props.channelId,
      });
      if (!initialTokenRequest) return;
      ablyClient = createAblyClient({
        async authCallback(_data, callback) {
          try {
            let tokenRequest = initialTokenRequest;
            initialTokenRequest = null;
            if (!tokenRequest) {
              tokenRequest = await tokenMutation.mutateAsync({
                channelId: props.channelId,
              });
            }
            if (!tokenRequest) throw new Error("No websockets token");
            callback(null, tokenRequest);
          } catch (err) {
            callback(err as ErrorInfo, null);
          }
        },
      });
      setRealtimeClient(ablyClient);
    };
    run();

    return () => {
      ablyClient?.close();
    };
  }, []);

  return realtimeClient;
};
