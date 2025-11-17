import type { AppProps } from "next/app";
import Head from "next/head";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import clsx from "clsx";
import CssBaseline from "@mui/material/CssBaseline";
import { Box } from "@mui/material";
import dynamic from "next/dynamic";
import { Provider as ReduxProvider } from "react-redux";

import { trpc } from "@/trpc/client";
import Navbar from "@/components/Navbar/Navbar";
import TopLoader from "@/components/TopLoader/TopLoader";
import { roboto, theme } from "@/utils/theme";
import { store } from "@/redux";

import "@/styles/global.scss";

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <ReduxProvider store={store}>
        <StyledEngineProvider injectFirst>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <TopLoader />
            <Box className={clsx("flex flex-col", roboto.variable)}>
              <Navbar />
              <main className="p-4">
                <Component {...pageProps} />
              </main>
            </Box>
          </ThemeProvider>
        </StyledEngineProvider>
      </ReduxProvider>
    </>
  );
};

export default trpc.withTRPC(App);
