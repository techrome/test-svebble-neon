import { useContext } from "react";
import { trpc } from "@/trpc";
import useAppQuery, { UseAppQueryOptions } from "@/utils/hooks/useAppQuery";
import { CACHE_TIME_MS } from "@/utils/cacheTime";
import { AuthedUserContext } from "@/components/PrivateRoute/PrivateRoute";

type TRPCQueryOptions = Omit<
  NonNullable<Parameters<typeof trpc.auth.user.useQuery>[1]>,
  "select"
>;

export const useUser = (
  trpcQueryOptions?: TRPCQueryOptions,
  appQueryOptions?: UseAppQueryOptions
) => {
  const user = useAppQuery(
    trpc.auth.user.useQuery(undefined, {
      staleTime: CACHE_TIME_MS.LONG,
      ...trpcQueryOptions,
    }),
    appQueryOptions
  );

  return user;
};

export const useAuthedUserData = () => {
  const user = useContext(AuthedUserContext);

  if (!user) {
    throw new Error(
      "useAuthedUserData must be guaranteed to have the user data."
    );
  }

  return user;
};
