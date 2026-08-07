import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as linksApi from "../../api/links";
import type { CreateLinkPayload } from "../../api/types";

export const LINKS_QUERY_KEY = ["links"] as const;

export function useLinks() {
  return useQuery({
    queryKey: LINKS_QUERY_KEY,
    queryFn: () => linksApi.listLinks({ page_size: 20 }),
  });
}

export function useCreateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateLinkPayload) => {
      const link = await linksApi.createLink(payload);
      // Chain enrichment right after saving, matching the frontend
      // architecture plan's "save & summarize" flow. Best-effort: the
      // backend already degrades gracefully on enrichment failure (the
      // link stays saved either way), so a failure here isn't fatal to
      // the save itself.
      try {
        await linksApi.enrichLink(link.id);
      } catch {
        // enrichment unavailable/failed — the link is still saved
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LINKS_QUERY_KEY });
    },
  });
}

export function useDeleteLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => linksApi.deleteLink(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LINKS_QUERY_KEY });
    },
  });
}
