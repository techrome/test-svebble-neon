declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "emoji-picker": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        class?: string;
      };
    }
  }
}

export {};
