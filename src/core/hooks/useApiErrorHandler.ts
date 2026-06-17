"use client";

import { useUser } from "@/core/contexts/UserContext";
import { useEffect } from "react";

export function useApiErrorHandler() {
  const { setShowReauthModal, userData } = useUser();

  useEffect(() => {
    // Store the original fetch function
    const originalFetch = window.fetch;

    // Create the async function outside of the assignment
    const createAsyncFetch = () => {
      return async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await originalFetch(input, init);

        // If we get a 401 and the user is logged in, show reauth modal
        if (response.status === 401 && userData) {
          // Only show modal for API calls (not auth endpoints)
          const url = typeof input === "string" ? input : input.toString();
          if (url.includes("/api/") && !url.includes("/api/auth")) {
            setShowReauthModal(true);
          }
        }

        return response;
      };
    };

    // Override fetch to intercept 401 responses
    window.fetch = createAsyncFetch();

    // Cleanup: restore original fetch when component unmounts
    return () => {
      window.fetch = originalFetch;
    };
  }, [setShowReauthModal, userData]);
}

// Alternative hook for specific fetch calls
function useAuthenticatedFetch() {
  const { setShowReauthModal, userData } = useUser();

  const authenticatedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    try {
      const response = await fetch(input, init);

      if (response.status === 401 && userData) {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/") && !url.includes("/api/auth")) {
          setShowReauthModal(true);
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  };

  return authenticatedFetch;
}
