import { trpc } from "@/trpc";
import useAppQuery, { UseAppQueryOptions } from "@/utils/hooks/useAppQuery";
import { CACHE_TIME_MS } from "@/utils/cacheTime";

type TRPCQueryOptions = Omit<
  NonNullable<Parameters<typeof trpc.messages.getReactions.useQuery>[1]>,
  "select"
>;

export const useMessageReactions = (
  trpcQueryOptions?: TRPCQueryOptions,
  appQueryOptions?: UseAppQueryOptions
) => {
  const data = useAppQuery(
    trpc.messages.getReactions.useQuery(undefined, {
      staleTime: CACHE_TIME_MS.LONG,
      ...trpcQueryOptions,
    }),
    appQueryOptions
  );

  return data;
};
