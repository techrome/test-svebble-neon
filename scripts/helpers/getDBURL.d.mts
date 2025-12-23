type GetDBURL = (env: Record<string, string | undefined>) => string;

export const getDBURL: GetDBURL;
export const getDBURLPrimary: GetDBURL;
