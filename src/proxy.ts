import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
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

  const isTenantScopedWebhook = path.startsWith(
    "/api/webhooks/imagina-energia/",
  );

  // Subdominio de tenant: bloquear webhooks legacy, permitir Imagina porque
  // su firma HMAC incluye la URL pública con subdominio tenant.
  // En desarrollo (localhost) se permite el acceso para testing
  if (path.startsWith("/api/webhooks/") && !isDev && !isTenantScopedWebhook) {
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
