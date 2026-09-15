import { NextRequest } from "next/server";
import { getAuth } from "@/core/auth/auth";

export interface AuthenticatedUser {
  id: string;
  role: string;
  email: string;
  name: string;
  activeOrganizationId?: string;
}

export interface AuthValidationResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

/**
 * Validates user session and extracts user information from request
 * @param request - Next.js request object
 * @returns Promise<AuthValidationResult>
 */
export async function validateUserSession(
  request: NextRequest
): Promise<AuthValidationResult> {
  try {
    const auth = getAuth(request);
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id || !session.user.role) {
      return {
        success: false,
        error: "Unauthorized: No valid session found",
      };
    }

    return {
      success: true,
      user: {
        id: session.user.id,
        role: session.user.role,
        email: session.user.email,
        name: session.user.name,
        activeOrganizationId:
          typeof session.session.activeOrganizationId === "string"
            ? session.session.activeOrganizationId
            : undefined,
      },
    };
  } catch (error) {
    console.error("Error validating session:", error);
    return {
      success: false,
      error: "Internal server error during authentication",
    };
  }
}

/**
 * Checks if user has permission to access/modify internal content
 * @param userRole - User's role
 * @returns boolean
 */
export function canAccessInternal(userRole: string): boolean {
  return userRole === "admin" || userRole === "1";
}

/**
 * Checks if user can change ticket status
 * @param userRole - User's role
 * @returns boolean
 */
export function canChangeTicketStatus(userRole: string): boolean {
  return userRole === "admin" || userRole === "1";
}

/**
 * Checks if user can assign tickets to others
 * @param userRole - User's role
 * @returns boolean
 */
export function canAssignTickets(userRole: string): boolean {
  return userRole === "admin" || userRole === "1";
}
