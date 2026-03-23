import React, { createContext, useContext, useState } from "react";
import dynamic from "next/dynamic";

import type {
  AblyRuntime,
  AblyRuntimeLoaderProps,
  WsClient,
} from "./AblyRuntimeLoader";

const AblyRuntimeLoader = dynamic<AblyRuntimeLoaderProps>(
  () => import("./AblyRuntimeLoader"),
  {
    ssr: false,
  }
);

const OptionalAblyContext = createContext<WsClient | null>(null);

export const useWsClient = () => useContext(OptionalAblyContext);

type Props = {
  children: React.ReactNode;
};

export function WebsocketsProvider({ children }: Props) {
  const [runtime, setRuntime] = useState<AblyRuntime | null>(null);

  return (
    <OptionalAblyContext.Provider value={runtime?.client || null}>
      {runtime ? (
        <runtime.AblyProvider client={runtime.client}>
          {children}
        </runtime.AblyProvider>
      ) : (
        children
      )}

      <AblyRuntimeLoader onReady={setRuntime} />
    </OptionalAblyContext.Provider>
  );
}
