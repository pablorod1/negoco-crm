import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const sessionCookie = getSessionCookie(request);
  const host = request.headers.get("host") || "";
  const isApiSubdomain =
    host.startsWith("api.") || host === "api.negococloud.es";
  const isDev = host.startsWith("localhost");

  // Subdominio api.negococloud.es: solo permite acceso a webhooks
  if (isApiSubdomain) {
    if (path.startsWith("/api/webhooks/")) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Subdominio de tenant: bloquear acceso a webhooks (solo vía api.negococloud.es)
  // En desarrollo (localhost) se permite el acceso para testing
  if (path.startsWith("/api/webhooks/") && !isDev) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const protectedPathsRegex = [
    /^\/tramites(\/.*)?$/,
    /^\/colaboradores(\/.*)?$/,
    /^\/documentacion(\/.*)?$/,
    /^\/liquidez(\/.*)?$/,
    /^\/comparativas(\/.*)?$/,
    /^\/fotovoltaica(\/.*)?$/,
    /^\/clientes(\/.*)?$/,
    /^\/comercializadoras(\/.*)?$/,
    /^\/perfil(\/.*)?$/,
    /^\/$/,
  ];

  const isProtectedPath = protectedPathsRegex.some((regex) => regex.test(path));
  const isApiProtected = path.startsWith("/api/v2");

  // Redirigir a login si no hay sesión en rutas protegidas.
  // Nota: `getSessionCookie` solo valida presencia de cookie, no vigencia.
  // La validación real de la sesión la hace el cliente (UserContext) y los
  // endpoints API (devuelven 401 → activa ReauthModal / redirect a login).
  if (isProtectedPath && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    if (path !== "/") {
      loginUrl.searchParams.set("redirectTo", path + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
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
    "/api/:path*",
    "/tramites/:path*",
    "/colaboradores/:path*",
    "/documentacion/:path*",
    "/liquidez/:path*",
    "/comparativas/:path*",
    "/fotovoltaica/:path*",
    "/clientes/:path*",
    "/comercializadoras/:path*",
    "/perfil/:path*",
    "/",
    "/login",
  ],
};
