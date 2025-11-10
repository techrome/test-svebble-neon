import type { AppProps } from "next/app";
import Head from "next/head";
import { EmotionCache } from "@emotion/cache";
import {
  AppCacheProvider,
  createEmotionCache,
} from "@mui/material-nextjs/v16-pagesRouter";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Roboto } from "next/font/google";
import { trpc } from "@/trpc/client";

import "@/styles/global.css";

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

const clientCache = createEmotionCache({ enableCssLayer: true, key: "my-mui" });

const App = ({
  Component,
  pageProps,
  emotionCache = clientCache,
}: AppProps & { emotionCache: EmotionCache }) => {
  return (
    <AppCacheProvider emotionCache={emotionCache}>
      {/* <GlobalStyles styles="@layer theme, base, mui, components, utilities;" /> */}
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
