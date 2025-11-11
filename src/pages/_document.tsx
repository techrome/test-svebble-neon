import {
  Head,
  Html,
  Main,
  NextScript,
  DocumentProps,
  DocumentContext,
} from "next/document";
import {
  DocumentHeadTags,
  documentGetInitialProps,
  DocumentHeadTagsProps,
} from "@mui/material-nextjs/v16-pagesRouter";
import { createEmotionCache } from "@/utils/createEmotionCache";

const Document = (props: DocumentProps & DocumentHeadTagsProps) => {
  return (
    <Html>
      <Head>
        <DocumentHeadTags {...props} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};

Document.getInitialProps = async (ctx: DocumentContext) => {
  const finalProps = await documentGetInitialProps(ctx, {
    emotionCache: createEmotionCache(),
  });
  return finalProps;
};

export default Document;
