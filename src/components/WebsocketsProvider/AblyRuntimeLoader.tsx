import { useEffect } from "react";
import type { ClientOptions, ErrorInfo } from "ably";
import { AblyProvider } from "ably/react";
import { BaseRealtime, FetchRequest, WebSocketTransport } from "ably/modular";

import { trpc } from "@/trpc";
import { useUser } from "@/trpc/hooks/useUser";

export type WsClient = BaseRealtime;

export type AblyRuntime = {
  client: WsClient;
  AblyProvider: typeof AblyProvider;
};

export type AblyRuntimeLoaderProps = {
  onReady: (runtime: AblyRuntime | null) => void;
};

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

export default function AblyRuntimeLoader({ onReady }: AblyRuntimeLoaderProps) {
  const tokenMutation = trpc.messages.ablyTokenRequest.useMutation();
  const user = useUser();
  const identityKey = user.data?.user?.id ?? "default";

  useEffect(() => {
    if (user.isPending) return;

    const client = createAblyClient({
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

    onReady({
      client,
      AblyProvider,
    });

    return () => {
      client.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.isPending, identityKey]);

  return null;
}
