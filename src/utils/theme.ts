import { Roboto } from "next/font/google";
import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import type {} from "@mui/x-date-pickers/themeAugmentation";

export const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

let _theme = createTheme({
  typography: {
    fontFamily: "var(--font-roboto)",
    allVariants: { wordBreak: "break-word" },
  },
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: true,
    dark: true,
  },
  modularCssLayers:
    "@layer global, base, mui, custom, components, utilities, sx, properties;",
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
        icon: { marginTop: _theme.spacing(1.5) },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          [theme.breakpoints.down("sm")]: {
            margin: theme.spacing(1),
            width: "100%",
          },
        }),
      },
    },
  },
};

_theme = responsiveFontSizes(_theme);

export type Breakpoints = (typeof theme.breakpoints.keys)[number];

export const theme = _theme;
