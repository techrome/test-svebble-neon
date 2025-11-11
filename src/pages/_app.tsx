import type { AppProps } from "next/app";
import Head from "next/head";
import {
  ThemeProvider,
  createTheme,
  StyledEngineProvider,
} from "@mui/material/styles";
import { Roboto } from "next/font/google";

import { trpc } from "@/trpc/client";

import "@/styles/global.css";
import CssBaseline from "@mui/material/CssBaseline";

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
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    dark: true,
    light: true,
  },
  modularCssLayers: "@layer theme, base, mui, components, utilities;",
});

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <main className={roboto.variable}>
            <Component {...pageProps} />
          </main>
        </ThemeProvider>
      </StyledEngineProvider>
    </>
  );
};

export default trpc.withTRPC(App);
