import * as htmlparser2 from "htmlparser2";
import sanitizeHtml from "sanitize-html";
import renderHTML from "dom-serializer";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "s",
  "u",
  "blockquote",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "a",
  "span",
];

const SPOILER_ATTR = {
  name: "data-spoiler",
  values: ["true"],
};

const spoilerAllowedAttributes = Object.fromEntries(
  ALLOWED_TAGS.map((tag) => [tag, [SPOILER_ATTR]])
);

export const sanitizeMessageHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      ...spoilerAllowedAttributes,
      a: ["href", "target", "rel", SPOILER_ATTR],
      li: [{ name: "data-list", values: ["ordered", "bullet"] }, SPOILER_ATTR],
    },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    nestingLimit: 8,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      }),
    },
  });

export const htmlToText = (html: string) =>
  htmlparser2.DomUtils.textContent(htmlparser2.parseDocument(html));

const MEANINGFUL_TEXT_RE = /[^\s\u00A0\u200B\u200C\u200D\uFEFF]/;

type ParsedDocument = ReturnType<typeof htmlparser2.parseDocument>;
type DomNode = ParsedDocument["children"][number];

const hasMeaningfulText = (text: string) => MEANINGFUL_TEXT_RE.test(text);

const checkIsEmptyNode = (node: DomNode): boolean => {
  if (node.type === "text") {
    return !hasMeaningfulText(node.data);
  }

  if (
    node.type === "comment" ||
    node.type === "directive" ||
    node.type === "cdata"
  ) {
    return true;
  }

  if ("name" in node) {
    if (node.name === "br") return true;
  }

  if (!("children" in node && Array.isArray(node.children))) {
    return true;
  }

  return node.children.every(checkIsEmptyNode);
};

const findMeaningfulNodeIndexes = (nodes: DomNode[]) => {
  let first = null;
  let last = null;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isNodeEmpty = checkIsEmptyNode(node);

    if (!isNodeEmpty) {
      if (first === null) {
        first = i;
      }

      last = i;
    }
  }

  return { first, last };
};

export const trimHtml = (html: string): string => {
  if (!html) return "";

  const document = htmlparser2.parseDocument(html);
  const nodes = document.children;

  const { first: firstMeaningfulIndex, last: lastMeaningfulIndex } =
    findMeaningfulNodeIndexes(nodes);

  if (firstMeaningfulIndex === null || lastMeaningfulIndex === null) {
    return "";
  }

  return nodes
    .slice(firstMeaningfulIndex, lastMeaningfulIndex + 1)
    .map((node) => renderHTML(node))
    .join("");
};
