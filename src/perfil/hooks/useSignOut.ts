"use client";

import { useCallback, useState } from "react";
import { authClient } from "@/core/auth/auth-client";
import { redirect } from "next/navigation";

export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          redirect("/login");
        },
      },
    });
  }, []);

  return { signOut, signingOut };
}
