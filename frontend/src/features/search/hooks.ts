import { useQuery } from "@tanstack/react-query";

import * as searchApi from "../../api/search";

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => searchApi.searchLinks(query),
    enabled: query.length > 0,
  });
}
