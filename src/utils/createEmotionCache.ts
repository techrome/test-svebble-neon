import { createEmotionCache as createCache } from "@mui/material-nextjs/v16-pagesRouter";

export const createEmotionCache = () =>
  createCache({
    enableCssLayer: true,
    key: "css",
  });
