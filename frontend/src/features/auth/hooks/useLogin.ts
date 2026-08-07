import { useMutation } from "@tanstack/react-query";

import type { LoginPayload } from "../../../api/types";
import { useAuth } from "../AuthContext";

/** Wraps AuthContext.login in TanStack Query for isPending/isError/error
 * form-submission state, per the architecture plan's server-state layer. */
export function useLogin() {
  const { login } = useAuth();
  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
  });
}
