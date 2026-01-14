import { trpc } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import { CACHE_TIME } from "@/utils/cacheTime";

export const useUser = () => {
  const user = useAppQuery(
    trpc.auth.user.useQuery(undefined, { staleTime: CACHE_TIME.LONG })
  );

  return user;
};

export const useAuthedUserData = () => {
  const user = useUser();

  if (!user.data?.user) {
    throw new Error(
      "useAuthedUserData must be guaranteed to have the user data."
    );
  }

  return user.data.user;
};
