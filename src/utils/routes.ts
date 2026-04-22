import { type Route } from "next";

type DynamicRoute = (...args: string[]) => Route;

export const privateRoutePrefix = "app";
export const authRoutePrefix = "auth";
export const oauthRoutePrefix = "oauth";

export const ANCHORS = {
  email: "email",
  username: "username",
  linkAccount: "linkAccount",
} as const;

export const ROUTES = {
  home: "/",
  about: "/about",
  terms: "/terms",
  privacyPolicy: "/privacy-policy",
  verifyEmailRedirect: "/verify-email-redirect",
  oauthStarting: `/${oauthRoutePrefix}/oauth-starting`,
  oauthDone: `/${oauthRoutePrefix}/oauth-done`,
  logIn: `/${authRoutePrefix}/log-in`,
  signUp: `/${authRoutePrefix}/sign-up`,
  accountRecovery: `/${authRoutePrefix}/account-recovery`,
  resetPassword: `/${authRoutePrefix}/reset-password`,
  test: "/test-not-found-page",
  private_emailVerified: `/${privateRoutePrefix}/email-verified`,
  private_myProfile: `/${privateRoutePrefix}/my-profile`,
  private_settings: `/${privateRoutePrefix}/settings`,
  channels: (id: string): `/channels/${string}` => `/channels/${id}`,
  //   users: (id: string): `/users/${string}` => `/users/${id}`,
} as const satisfies Record<string, Route | DynamicRoute>;

export type RouteKeys = keyof typeof ROUTES;
export type RouteValues = (typeof ROUTES)[RouteKeys];
type StaticRoutes = Extract<RouteValues, Route>;
type DynamicRoutes = ReturnType<Extract<RouteValues, DynamicRoute>>;

type SamePathHref = `?${string}` | `#${string}` | `?${string}#${string}`;
export type AllRoutes = StaticRoutes | DynamicRoutes | SamePathHref;
