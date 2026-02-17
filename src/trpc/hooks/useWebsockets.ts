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
    const ablyClient = createAblyClient({
      async authCallback(_data, callback) {
        try {
          const tokenRequest = await tokenMutation.mutateAsync();
          callback(null, tokenRequest);
        } catch (err) {
          callback(err as ErrorInfo, null);
        }
      },
    });

    setRealtimeClient(ablyClient);

    return () => {
      ablyClient.close();
      setRealtimeClient(null);
    };
  }, []);

  return realtimeClient;
};
