import React from "react";

export type QueryKeys = Record<string, true>;
type Type = (queryKey: string, active: boolean) => void;

export const LoadingBoundaryContext = React.createContext<Type>(() => {});
