import { trpc } from "@/trpc";
import { QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";

export const userLoginLifecycle = (qc: QueryClient) => {
  const userKey = getQueryKey(trpc.auth.user, undefined, "query");
  const freshUserKey = getQueryKey(trpc.auth.freshUser, undefined, "query");

  qc.invalidateQueries({
    queryKey: userKey,
  });
  qc.removeQueries({
    queryKey: freshUserKey,
  });
};

export const userLogoutLifecycle = (qc: QueryClient) => {
  const userKey = getQueryKey(trpc.auth.user, undefined, "query");
  const freshUserKey = getQueryKey(trpc.auth.freshUser, undefined, "query");
  const listUserAccountsKey = getQueryKey(
    trpc.auth.listUserAccounts,
    undefined,
    "query"
  );

  qc.setQueryData(userKey, { user: null });
  qc.setQueryData(freshUserKey, { user: null });
  qc.removeQueries({ queryKey: userKey });
  qc.removeQueries({ queryKey: freshUserKey });
  qc.removeQueries({ queryKey: listUserAccountsKey });
};
