import React from "react";
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

export const useWebsockets = () => {
  const tokenMutation = trpc.messages.ablyTokenRequest.useMutation();
  const [realtimeClient, setRealtimeClient] = React.useState<Realtime | null>(
    null
  );

  React.useEffect(() => {
    let ablyClient: BaseRealtime | null = null;
    const run = async () => {
      let initialTokenRequest = await tokenMutation.mutateAsync();
      if (!initialTokenRequest) return;
      ablyClient = createAblyClient({
        async authCallback(_data, callback) {
          try {
            let tokenRequest = initialTokenRequest;
            initialTokenRequest = null;
            if (!tokenRequest) {
              tokenRequest = await tokenMutation.mutateAsync();
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
