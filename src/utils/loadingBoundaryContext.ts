import React from "react";

export type QueryKeys = Record<string, true>;
type Type = {
  queryKeys: QueryKeys;
  setQueryKeys: React.Dispatch<React.SetStateAction<QueryKeys>>;
};

export const LoadingBoundaryContext = React.createContext<Type>({
  queryKeys: {},
  setQueryKeys: () => {},
});
