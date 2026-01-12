import { trpc } from "@/trpc";
import useAppQuery from "@/utils/hooks/useAppQuery";
import { CACHE_TIME } from "@/utils/cacheTime";

const useUser = () => {
  const user = useAppQuery(
    trpc.auth.user.useQuery(undefined, { staleTime: CACHE_TIME.LONG })
  );

  return user;
};

export default useUser;
