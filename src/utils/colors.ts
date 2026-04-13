import { ThemeOptions } from "@mui/material/styles";

export const colorSchemes = {
  light: {
    palette: {
      primary: { main: "#1976d2" },
      secondary: { main: "#9c27b0" },
      text: {
        disabled: "rgba(0, 0, 0, 0.5)",
      },
    },
  },
  dark: {
    palette: {
      primary: {
        main: "#90caf9",
      },
      secondary: {
        main: "#ce93d8",
      },
    },
  },
} as const satisfies ThemeOptions["colorSchemes"];
