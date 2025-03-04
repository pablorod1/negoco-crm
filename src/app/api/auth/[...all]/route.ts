import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/auth";

export async function POST(req: NextRequest) {
  const auth = getAuth(req);
  return toNextJsHandler(auth.handler).POST(req);
}

export async function GET(req: NextRequest) {
  const auth = getAuth(req);
  return toNextJsHandler(auth.handler).GET(req);
}
