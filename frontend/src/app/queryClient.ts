import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Matches the architecture plan's cache strategy: brief staleness,
      // explicit invalidation on mutation rather than aggressive background
      // refetching — no queries exist yet in this module, but this is the
      // shared client future features (links, search) will use too.
      staleTime: 30_000,
      retry: 1,
    },
  },
});
