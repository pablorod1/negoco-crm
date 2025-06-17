import "server-only";
import { cache } from "react";
import { getAuth } from "./auth/auth";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";

export const verifySession = cache(async (req: NextRequest) => {
  const session = await getAuth(req).api.getSession({
    headers: req.headers,
  });

  if (!session) {
    redirect("/login");
  }

  return { isAuth: true, session };
});
