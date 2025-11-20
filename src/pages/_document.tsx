import { Head, Html, Main, NextScript } from "next/document";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

import { roboto } from "@/utils/theme";

const Document = () => {
  return (
    <Html>
      <Head />
      <body className={roboto.variable}>
        <InitColorSchemeScript attribute="class" />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};

export default Document;
