import React from "react";

export const htmlToText = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
};

const recursiveCollectNodes = (node: React.ReactNode): string[] => {
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap(recursiveCollectNodes);
  }

  if (React.isValidElement(node)) {
    return recursiveCollectNodes(
      (node.props as React.PropsWithChildren)?.children
    );
  }

  return [];
};

export const reactNodeToText = (node: React.ReactNode): string => {
  const out = recursiveCollectNodes(node).join(" ");
  return out;
};
