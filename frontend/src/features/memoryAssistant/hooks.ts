import { useMutation } from "@tanstack/react-query";

import * as searchApi from "../../api/search";

export function useAskMemoryAssistant() {
  return useMutation({
    mutationFn: (question: string) => searchApi.askMemoryAssistant(question),
  });
}
