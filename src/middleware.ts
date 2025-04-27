import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const sessionCookie = getSessionCookie(request);
  console.log("Session Cookie:", sessionCookie);
  const protectedPathsRegex = [
    /^\/tramites(\/.*)?$/,
    /^\/colaboradores(\/.*)?$/,
    /^\/documentacion(\/.*)?$/,
    /^\/liquidez(\/.*)?$/,
    /^\/comparativas(\/.*)?$/,
    /^\/$/,
  ];

  const isProtectedPath = protectedPathsRegex.some((regex) => regex.test(path));
  const isApiProtected = path.startsWith("/api") && !path.includes("auth");

  // Redirigir a login si no hay sesión en rutas protegidas
  if (isProtectedPath && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirigir a la home si el usuario ya está autenticado y accede a /login
  if (sessionCookie && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Verificar autenticación para las rutas de API protegidas
  if (isApiProtected && !sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/auth", // Excluir rutas de autenticación de la verificación
    "/tramites",
    "/tramites/:path*",
    "/colaboradores",
    "/documentacion",
    "/liquidez",
    "/comparativas",
    "/comparativas/:path*",
    "/documentacion/:path*",
    "/",
    "/api/:path*",
  ],
};
