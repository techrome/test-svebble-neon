import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import type {} from "@mui/x-date-pickers/themeAugmentation";

import { colorSchemes } from "@/utils/colors";
declare module "@mui/material/styles" {
  interface TypographyVariants {
    tiny: React.CSSProperties;
  }

  interface TypographyVariantsOptions {
    tiny?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    tiny: true;
  }
}

let _theme = createTheme({
  typography: {
    fontFamily: "var(--font-roboto)",
    allVariants: { wordBreak: "break-word" },
    tiny: {
      fontSize: "0.625rem",
      lineHeight: 1.5,
    },
  },
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes,
  modularCssLayers:
    "@layer global, base, mui, custom, components, utilities, sx, properties;",
});

_theme = {
  ..._theme,
  components: {
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          tiny: "p",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            "& > .MuiButton-icon > img": {
              opacity: "0.5",
            },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { maxWidth: "min(450px, calc(100vw))" },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: _theme.spacing(5),
        },
      },
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
        icon: { marginTop: _theme.spacing(1.25) },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          [_theme.breakpoints.down("sm")]: {
            margin: _theme.spacing(1),
            width: "100%",
            maxHeight: `calc(100% - ${_theme.spacing(2)})`,
          },
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: _theme.spacing(0, 3, 3, 3),
          [_theme.breakpoints.down("sm")]: {
            padding: _theme.spacing(0, 2, 2, 2),
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          transition: `var(--default-transition-duration)`,
          "&:hover": {
            backgroundColor: _theme.vars?.palette.action.hover,
          },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        asterisk: {
          color: _theme.vars?.palette.error.main,
        },
      },
    },
  },
};

_theme = responsiveFontSizes(_theme);

export type Breakpoints = (typeof theme.breakpoints.keys)[number];

export const theme = _theme;
