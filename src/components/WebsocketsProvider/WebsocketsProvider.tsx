import React, { useEffect, useState } from "react";
import { AblyProvider } from "ably/react";
import type { ClientOptions, ErrorInfo } from "ably";
import { BaseRealtime, FetchRequest, WebSocketTransport } from "ably/modular";

import { trpc } from "@/trpc";
import { useUser } from "@/trpc/hooks/useUser";

const createAblyClient = (opts: ClientOptions) => {
  return new BaseRealtime({
    plugins: {
      WebSocketTransport,
      FetchRequest,
    },
    ...opts,
  });
};

const toAblyError = (err?: unknown): string | ErrorInfo => {
  if (err instanceof Error) return err.message;
  return "Failed to get Ably token";
};

type Props = {
  children: React.ReactNode;
};

export const WebsocketsProvider = (props: Props) => {
  const tokenMutation = trpc.messages.ablyTokenRequest.useMutation();
  const user = useUser();
  const identityKey = user.data?.user?.id || "guest";

  const [client, setClient] = useState<BaseRealtime>(() =>
    createAblyClient({
      autoConnect: false,
      authCallback(_data, callback) {
        callback(toAblyError(), null);
      },
    })
  );

  useEffect(() => {
    if (user.isPending) return;

    const nextClient = createAblyClient({
      authCallback(_data, callback) {
        void (async () => {
          try {
            const tokenRequest = await tokenMutation.mutateAsync();
            if (!tokenRequest) throw new Error("No Ably token");
            callback(null, tokenRequest);
          } catch (err) {
            callback(toAblyError(err), null);
          }
        })();
      },
    });

    setClient((prev) => {
      prev.close();
      return nextClient;
    });

    return () => {
      nextClient.close();
    };
  }, [user.isPending, identityKey]);

  return <AblyProvider client={client}>{props.children}</AblyProvider>;
};
