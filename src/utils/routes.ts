import { Route } from "next";

type DynamicRoute = (...args: string[]) => Route;

export const privateRoutePrefix = "app";

export const ROUTES = {
  home: "/",
  about: "/about",
  terms: "/terms",
  privacyPolicy: "/privacy-policy",
  test: "/test-not-found-page",
  private_emailVerified: `/${privateRoutePrefix}/email-verified`,
  private_myProfile: `/${privateRoutePrefix}/my-profile`,
  private_settings: `/${privateRoutePrefix}/settings`,
  //   users: (id: string): `/users/${string}` => `/users/${id}`,
} as const satisfies Record<string, Route | DynamicRoute>;

export type RouteKeys = keyof typeof ROUTES;
export type RouteValues = (typeof ROUTES)[RouteKeys];
type StaticRoutes = Extract<RouteValues, Route>;
type DynamicRoutes = ReturnType<Extract<RouteValues, DynamicRoute>>;

export type AllRoutes = StaticRoutes | DynamicRoutes;
