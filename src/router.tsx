import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route code + data on hover / touch-down so clicks feel instant.
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    // Let TanStack Query own freshness; keep preloaded data usable on click.
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
  });

  return router;
};
