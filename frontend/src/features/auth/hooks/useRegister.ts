import { useMutation } from "@tanstack/react-query";

import type { RegisterPayload } from "../../../api/types";
import { useAuth } from "../AuthContext";

export function useRegister() {
  const { register } = useAuth();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
  });
}
