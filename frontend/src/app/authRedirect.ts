const DEFAULT_AUTHENTICATED_ROUTE = "/";

function isAuthPage(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export function buildAuthRedirectPath(location: {
  pathname: string;
  search?: string;
  hash?: string;
}) {
  const requestedPath = `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`;
  const searchParams = new URLSearchParams({ redirectTo: requestedPath });
  return `/login?${searchParams.toString()}`;
}

export function resolvePostAuthPath(redirectTo: string | null | undefined) {
  if (!redirectTo || !redirectTo.startsWith("/")) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }

  try {
    const url = new URL(redirectTo, "http://chessview.local");
    if (isAuthPage(url.pathname)) {
      return DEFAULT_AUTHENTICATED_ROUTE;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }
}

export function withRedirectQuery(pathname: "/login" | "/register", redirectTo: string) {
  if (!redirectTo || redirectTo === DEFAULT_AUTHENTICATED_ROUTE) {
    return pathname;
  }

  const searchParams = new URLSearchParams({ redirectTo });
  return `${pathname}?${searchParams.toString()}`;
}

export { DEFAULT_AUTHENTICATED_ROUTE };
