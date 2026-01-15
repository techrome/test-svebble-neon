import React from "react";
import { trpc } from "@/trpc";
import useAppQuery, { UseAppQueryOptions } from "@/utils/hooks/useAppQuery";
import { CACHE_TIME } from "@/utils/cacheTime";
import { TRPCQueryOptions } from "@/trpc/hooks/useUser";

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

export const useFreshAuthedUserData = (
  trpcQueryOptions?: TRPCQueryOptions,
  appQueryOptions?: UseAppQueryOptions
) => {
  const freshUser = useFreshUser(trpcQueryOptions, appQueryOptions);

  if (!freshUser.data?.user) {
    throw new Error(
      "useFreshAuthedUserData must be guaranteed to have the user data."
    );
  }

  return freshUser.data.user;
};
