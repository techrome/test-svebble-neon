import type { AppProps } from "next/app";
import Head from "next/head";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import clsx from "clsx";
import CssBaseline from "@mui/material/CssBaseline";
import { Provider as ReduxProvider } from "react-redux";
import { ErrorBoundary } from "react-error-boundary";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/en-gb";

import { trpc } from "@/trpc";
import Navbar from "@/components/Navbar/Navbar";
import TopLoader from "@/components/TopLoader/TopLoader";
import { theme } from "@/utils/theme";
import { store } from "@/redux";
import GlobalModal from "@/components/Overlays/GlobalModal";
import GlobalDrawer from "@/components/Overlays/GlobalDrawer";
import { Section } from "@/components/Layout/Containers";
import ErrorBoundaryFallback from "@/components/GlobalError/ErrorBoundaryFallback";
import SnackbarProvider from "@/components/Snackbar/SnackbarProvider";
import { SnackbarListener } from "@/utils/snackbar";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";

import "@/styles/global.scss";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { authRoutePrefix, privateRoutePrefix } from "@/utils/routes";
import { AuthPageWrapper } from "@/components/AuthForm/Helpers";

const PrivateRoute = dynamic(
  () => import("@/components/PrivateRoute/PrivateRoute").then((m) => m.default),
  { ssr: false }
);

const App = ({ Component, pageProps }: AppProps) => {
  const router = useRouter();
  const isPrivateRoute = router.pathname.startsWith(`/${privateRoutePrefix}`);
  const isAuthRoute = router.pathname.startsWith(`/${authRoutePrefix}`);

  const page = <Component {...pageProps} />;

  return (
    <>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <ReduxProvider store={store}>
        <StyledEngineProvider injectFirst>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <SnackbarProvider>
              <LocalizationProvider
                dateAdapter={AdapterDayjs}
                adapterLocale="en-gb"
              >
                <SnackbarListener />
                <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                  <TopLoader />
                  <LoadingBoundary>
                    <div className={clsx("flex flex-col min-h-screen")}>
                      <Navbar />
                      <Section addClassName="flex-1 flex flex-col">
                        {isPrivateRoute ? (
                          <PrivateRoute>{page}</PrivateRoute>
                        ) : isAuthRoute ? (
                          <AuthPageWrapper>{page}</AuthPageWrapper>
                        ) : (
                          page
                        )}
                      </Section>
                      <GlobalModal />
                      <GlobalDrawer />
                    </div>
                  </LoadingBoundary>
                </ErrorBoundary>
              </LocalizationProvider>
            </SnackbarProvider>
          </ThemeProvider>
        </StyledEngineProvider>
      </ReduxProvider>
    </>
  );
};

export default trpc.withTRPC(App);
