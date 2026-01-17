import React from "react";
import { trpc } from "@/trpc";
import useAppQuery, { UseAppQueryOptions } from "@/utils/hooks/useAppQuery";
import { CACHE_TIME } from "@/utils/cacheTime";

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
      staleTime: CACHE_TIME.QUICK,
      ...trpcQueryOptions,
    }),
    appQueryOptions
  );
  const utils = trpc.useUtils();

  React.useEffect(() => {
    if (freshUser.data && !freshUser.isStale) {
      utils.auth.user.cancel().then(() => {
        utils.auth.user.setData(undefined, freshUser.data);
      });
    }
    // eslint-disable-next-line
  }, [freshUser.dataUpdatedAt]);

  return freshUser;
};
