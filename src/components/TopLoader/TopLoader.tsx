import { useEffect } from "react";
import Router from "next/router";
import NProgress from "nprogress";

const DELAY_MS = 200;

const TopLoader = () => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let loading = false;

    NProgress.configure({
      showSpinner: false,
    });

    const start = () => {
      if (loading) {
        return;
      }
      loading = true;

      timer = setTimeout(() => {
        if (!loading) {
          return;
        }
        NProgress.start();
      }, DELAY_MS);
    };

    const done = () => {
      loading = false;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      if (NProgress.isStarted()) {
        NProgress.done(true);
      }
    };

    Router.events.on("routeChangeStart", start);
    Router.events.on("routeChangeComplete", done);
    Router.events.on("routeChangeError", done);

    return () => {
      Router.events.off("routeChangeStart", start);
      Router.events.off("routeChangeComplete", done);
      Router.events.off("routeChangeError", done);
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return null;
};

export default TopLoader;
