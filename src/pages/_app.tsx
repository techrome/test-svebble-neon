import type { AppProps } from "next/app";
import Head from "next/head";
import { EmotionCache } from "@emotion/cache";
import { AppCacheProvider } from "@mui/material-nextjs/v16-pagesRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Roboto } from "next/font/google";
import { trpc } from "@/trpc/client";

import "@/styles/global.css";
import { createEmotionCache } from "@/utils/createEmotionCache";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

const theme = createTheme({
  typography: {
    fontFamily: "var(--font-roboto)",
  },
  cssVariables: true,
});

const clientCache = createEmotionCache();

const App = ({
  Component,
  pageProps,
  emotionCache = clientCache,
}: AppProps & { emotionCache: EmotionCache }) => {
  return (
    <AppCacheProvider emotionCache={emotionCache}>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <ThemeProvider theme={theme}>
        <main className={roboto.variable}>
          <Component {...pageProps} />
        </main>
      </ThemeProvider>
    </AppCacheProvider>
  );
};

export default trpc.withTRPC(App);
