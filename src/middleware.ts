import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const sessionCookie = getSessionCookie(request);

  // Si hay un sessionToken y se intenta acceder a /login, redirigir a /
  if (path === "/login" && sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Excluir específicamente /api/auth de la autenticación
  if (path.startsWith("/api/") && !path.startsWith("/api/auth/")) {
    if (!sessionCookie) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  // Mantén la lógica de redirección para rutas de interfaz de usuario
  if (["/", "/tramites", "/colaboradores", "/documentacion"].includes(path)) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/tramites",
    "/colaboradores",
    "/documentacion/:path*",
    "/api/:path*",
  ],
};
