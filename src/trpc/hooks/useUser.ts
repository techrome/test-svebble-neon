import { trpc } from "@/trpc";
import useAppQuery, { UseAppQueryOptions } from "@/utils/hooks/useAppQuery";
import { CACHE_TIME } from "@/utils/cacheTime";

export type TRPCQueryOptions = Omit<
  NonNullable<Parameters<typeof trpc.auth.user.useQuery>[1]>,
  "select"
>;

export const useUser = (
  trpcQueryOptions?: TRPCQueryOptions,
  appQueryOptions?: UseAppQueryOptions
) => {
  const user = useAppQuery(
    trpc.auth.user.useQuery(undefined, {
      staleTime: CACHE_TIME.LONG,
      ...trpcQueryOptions,
    }),
    appQueryOptions
  );

  return user;
};

export const useAuthedUserData = (
  trpcQueryOptions?: TRPCQueryOptions,
  appQueryOptions?: UseAppQueryOptions
) => {
  const user = useUser(trpcQueryOptions, appQueryOptions);

  if (!user.data?.user) {
    throw new Error(
      "useAuthedUserData must be guaranteed to have the user data."
    );
  }

  return user.data.user;
};
