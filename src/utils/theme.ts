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
    sm: true; // 40rem  (640px @ 16px root)
    md: true; // 48rem  (768px)
    lg: true; // 64rem  (1024px)
    xl: true; // 80rem  (1280px)
    "2xl": true; // 96rem  (1536px)
  }
}

let _theme = createTheme({
  typography: {
    fontFamily: "var(--font-roboto)",
  },
  breakpoints: {
    // copying the tailwind breakpoints
    unit: "rem",
    values: {
      sm: 40,
      md: 48,
      lg: 64,
      xl: 80,
      "2xl": 96,
    },
  },
  spacing: (factor: number) => `${0.25 * factor}rem`,
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: true,
    dark: true,
  },
  modularCssLayers: "@layer base, mui, components, utilities;",
});

_theme = responsiveFontSizes(_theme);

export const theme = _theme;
