import * as htmlparser2 from "htmlparser2";
import sanitizeHtml from "sanitize-html";
import renderHTML from "dom-serializer";

const ALLOWED_BLOCK_TAGS = ["p", "blockquote", "pre", "ul", "ol", "li", "br"];

const ALL_ALLOWED_TAGS = [
  ...ALLOWED_BLOCK_TAGS,
  "strong",
  "em",
  "s",
  "u",
  "code",
  "a",
  "span",
];

const BLOCK_TAG_REGEX = new RegExp(
  String.raw`</?(?:${ALLOWED_BLOCK_TAGS.join("|")})\b[^>]*>`,
  "gi"
);

const SPOILER_ATTR = {
  name: "sp",
  values: ["1"],
};

const spoilerAllowedAttributes = Object.fromEntries(
  ALL_ALLOWED_TAGS.map((tag) => [tag, [SPOILER_ATTR]])
);

export const sanitizeMessageHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ALL_ALLOWED_TAGS,
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

type ParsedDocument = ReturnType<typeof htmlparser2.parseDocument>;
type DomNode = ParsedDocument["children"][number];
type HTMLDocument = ReturnType<typeof htmlparser2.parseDocument>;

export const htmlToText = (html: string): string =>
  htmlparser2.DomUtils.textContent(
    // doing this to add spaces between tags to avoid sticky letters
    htmlparser2.parseDocument(html.replace(BLOCK_TAG_REGEX, " "))
  )
    .replace(/\s+/g, " ")
    .trim();

const MEANINGFUL_TEXT_RE = /[^\s\u00A0\u200B\u200C\u200D\uFEFF]/;

const hasMeaningfulText = (text: string) => MEANINGFUL_TEXT_RE.test(text);

const checkIsEmptyNode = (node: DomNode): boolean => {
  if (node.type === "text") {
    return !hasMeaningfulText(node.data);
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

export const trimHtml = (document: HTMLDocument): string => {
  const nodes = document.children;

  const { first: firstMeaningfulIndex, last: lastMeaningfulIndex } =
    findMeaningfulNodeIndexes(nodes);

  if (firstMeaningfulIndex === null || lastMeaningfulIndex === null) {
    return "";
  }

  return nodes
    .slice(firstMeaningfulIndex, lastMeaningfulIndex + 1)
    .map((node) => renderHTML(node, { encodeEntities: "utf8" }))
    .join("");
};
