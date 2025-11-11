import { Head, Html, Main, NextScript } from "next/document";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

const Document = () => {
  return (
    <Html>
      <Head />
      <body>
        <InitColorSchemeScript attribute="class" />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};

export default Document;
