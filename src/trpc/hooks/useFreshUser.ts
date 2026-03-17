// eslint-disable-next-line
import React from "react";
import { trpc } from "@/trpc";
import useAppQuery, { UseAppQueryOptions } from "@/utils/hooks/useAppQuery";
import { CACHE_TIME_MS } from "@/utils/cacheTime";
import { useEffectAfterMount } from "@/utils/hooks/useEffectAfterMount";

type TRPCQueryOptions = Omit<
  NonNullable<Parameters<typeof trpc.auth.freshUser.useQuery>[1]>,
  "select"
>;

export const useFreshUser = (
  trpcQueryOptions?: TRPCQueryOptions,
  appQueryOptions?: UseAppQueryOptions
) => {
  const freshUser = useAppQuery(
    trpc.auth.freshUser.useQuery(undefined, {
      staleTime: CACHE_TIME_MS.QUICK,
      ...trpcQueryOptions,
    }),
    appQueryOptions
  );
  const utils = trpc.useUtils();

  // only updating cached user when we have actual new user data, not on first mount
  useEffectAfterMount(() => {
    if (freshUser.data && !freshUser.isStale) {
      utils.auth.user.cancel().then(() => {
        utils.auth.user.setData(undefined, freshUser.data);
      });
    }
  }, [freshUser.dataUpdatedAt]);

  return freshUser;
};
