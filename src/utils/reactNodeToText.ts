import React from "react";

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
