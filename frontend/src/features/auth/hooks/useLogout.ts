import { useMutation } from "@tanstack/react-query";

import { useAuth } from "../AuthContext";

export function useLogout() {
  const { logout } = useAuth();
  return useMutation({
    mutationFn: () => logout(),
  });
}
