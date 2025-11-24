import type { AppProps } from "next/app";
import Head from "next/head";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import clsx from "clsx";
import CssBaseline from "@mui/material/CssBaseline";
import { Box } from "@mui/material";
import { Provider as ReduxProvider } from "react-redux";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";
import Navbar from "@/components/Navbar/Navbar";
import TopLoader from "@/components/TopLoader/TopLoader";
import { theme } from "@/utils/theme";
import { store } from "@/redux";
import GlobalModal from "@/components/Overlays/GlobalModal";
import GlobalDrawer from "@/components/Overlays/GlobalDrawer";
import { Section } from "@/components/Layout/Containers";
import ErrorBoundaryFallback from "@/components/GlobalError/ErrorBoundaryFallback";

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
            <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
              <TopLoader />
              <Box className={clsx("flex flex-col min-h-screen")}>
                <Navbar />
                <Section addClassName="flex-1 flex flex-col">
                  <Component {...pageProps} />
                </Section>
                <GlobalModal />
                <GlobalDrawer />
              </Box>
            </ErrorBoundary>
          </ThemeProvider>
        </StyledEngineProvider>
      </ReduxProvider>
    </>
  );
};

export default trpc.withTRPC(App);
