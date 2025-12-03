import { Roboto } from "next/font/google";
import { createTheme, responsiveFontSizes } from "@mui/material/styles";

export const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

declare module "@mui/system" {
  interface BreakpointOverrides {
    xs: false;
    sm: true;
    md: true;
    lg: true;
    xl: true;
    "2xl": true;
  }
}

let _theme = createTheme({
  typography: {
    fontFamily: "var(--font-roboto)",
    allVariants: { wordBreak: "break-word" },
  },
  spacing: (factor: number) => `${0.25 * factor}rem`,
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: true,
    dark: true,
  },
  modularCssLayers: "@layer base, mui, components, utilities;",
});

_theme = {
  ..._theme,
  components: {
    MuiTooltip: {
      styleOverrides: { tooltip: { maxWidth: "450px" } },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ ownerState }) => {
          let common = { position: "relative" } as const;
          if (ownerState.variant !== "standard") {
            return common;
          }

          const textColor =
            _theme.vars?.palette.text.primary ?? _theme.palette.text.primary;

          return {
            ...common,
            color: textColor,
          };
        },
        message: { flex: "1" },
        icon: { marginTop: _theme.spacing(2) },
      },
    },
  },
};

_theme = responsiveFontSizes(_theme);

export type Breakpoints = (typeof theme.breakpoints.keys)[number];

export const theme = _theme;
