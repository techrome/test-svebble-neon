import type { AppProps } from "next/app";
import Head from "next/head";
import {
  ThemeProvider,
  createTheme,
  StyledEngineProvider,
  responsiveFontSizes,
} from "@mui/material/styles";
import { Roboto } from "next/font/google";
import clsx from "clsx";

import { trpc } from "@/trpc/client";

import "@/styles/global.css";
import CssBaseline from "@mui/material/CssBaseline";
import Navbar from "@/components/Navbar/Navbar";
import { Box } from "@mui/material";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

declare module "@mui/system" {
  interface BreakpointOverrides {
    xs: false;
    sm: true; // 40rem  (640px @ 16px root)
    md: true; // 48rem  (768px)
    lg: true; // 64rem  (1024px)
    xl: true; // 80rem  (1280px)
    "2xl": true; // 96rem  (1536px)
  }
}

let theme = createTheme({
  typography: {
    fontFamily: "var(--font-roboto)",
  },
  breakpoints: {
    // copying the tailwind breakpoints
    unit: "rem",
    values: {
      sm: 40,
      md: 48,
      lg: 64,
      xl: 80,
      "2xl": 96,
    },
  },
  spacing: (factor: number) => `${0.25 * factor}rem`,
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: true,
    dark: true,
  },
  modularCssLayers: "@layer theme, base, mui, components, utilities;",
});

theme = responsiveFontSizes(theme);

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Box className={clsx("flex flex-col", roboto.variable)}>
            <Navbar />
            <main>
              <Component {...pageProps} />
            </main>
          </Box>
        </ThemeProvider>
      </StyledEngineProvider>
    </>
  );
};

export default trpc.withTRPC(App);
