import { useEffect } from "react";
import Router from "next/router";
import NProgress from "nprogress";

const DELAY_MS = 300;

const TopLoader = () => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;

    NProgress.configure({
      showSpinner: false,
    });

    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(NProgress.start, DELAY_MS);
    };

    const done = () => {
      clearTimeout(timer);
      timer = undefined;
      NProgress.done();
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
