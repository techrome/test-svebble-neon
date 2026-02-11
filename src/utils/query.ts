import { useRouter } from "next/router";

export const getRouterQueryValue = (
  queryVal: ReturnType<typeof useRouter>["query"][string]
) => {
  return Array.isArray(queryVal)
    ? queryVal.length > 0
      ? queryVal[queryVal.length - 1]
      : undefined
    : queryVal || undefined;
};

export const parseQueryString = (queryStr: string): URLSearchParams => {
  const queryStart = queryStr.indexOf("?");
  if (queryStart === -1) return new URLSearchParams();

  const hashStart = queryStr.indexOf("#", queryStart + 1);
  const queryString =
    hashStart === -1
      ? queryStr.slice(queryStart + 1)
      : queryStr.slice(queryStart + 1, hashStart);

  return new URLSearchParams(queryString);
};
