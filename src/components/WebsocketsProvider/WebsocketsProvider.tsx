import React, { createContext, useContext, useEffect, useState } from "react";
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

const OptionalAblyContext = createContext<BaseRealtime | null>(null);

export const useWsClient = () => useContext(OptionalAblyContext);

type OptionalAblyContextProps = {
  client: BaseRealtime | null;
  children: React.ReactNode;
};

export function OptionalAblyProvider({
  client,
  children,
}: OptionalAblyContextProps) {
  return (
    <OptionalAblyContext.Provider value={client}>
      {client ? (
        <AblyProvider client={client}>{children}</AblyProvider>
      ) : (
        children
      )}
    </OptionalAblyContext.Provider>
  );
}

type WebsocketsProvider = {
  children: React.ReactNode;
};

export const WebsocketsProvider = (props: WebsocketsProvider) => {
  const tokenMutation = trpc.messages.ablyTokenRequest.useMutation();
  const user = useUser();
  const identityKey = user.data?.user?.id || "default";

  const [client, setClient] = useState<BaseRealtime | null>(null);

  useEffect(() => {
    if (user.isPending) return;
    const newClient = createAblyClient({
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
    setClient(newClient);

    return () => {
      newClient.close();
    };
    // eslint-disable-next-line
  }, [user.isPending, identityKey]);

  return (
    <OptionalAblyProvider client={client}>
      {props.children}
    </OptionalAblyProvider>
  );
};
