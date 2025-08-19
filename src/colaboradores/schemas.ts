import { z } from "zod";

// Role enum aligned with the app's role system
export const UserRoleEnum = z.enum(["admin", "1", "2"], {
  required_error: "El rol es obligatorio",
});

// Organization role enum for membership
export const OrganizationRoleEnum = z.enum(["member", "admin", "owner"], {
  required_error: "El rol de organización es obligatorio",
});

// User creation schema
export const CreateUserSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre es demasiado largo"),
  email: z.string().email("El email debe ser válido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(100, "La contraseña es demasiado larga"),
  role: UserRoleEnum,
  company: z.string().nullable().optional(),
});

// Organization membership schema
export const OrganizationMembershipSchema = z.object({
  userId: z.string().min(1, "El ID del usuario es obligatorio"),
  organizationId: z.string().min(1, "El ID de la organización es obligatorio"),
  role: z.string().min(1, "El rol es obligatorio"), // Keep as string for BetterAuth compatibility
});

// Super user assignment schema
export const SuperUserAssignmentSchema = z.object({
  super_id: z.string().min(1, "El ID del jefe de equipo es obligatorio"),
});

// Company assignment schema
export const CompanyAssignmentSchema = z.object({
  company: z.string().min(1, "El nombre de la empresa es obligatorio"),
});

// Email notification schema
export const WelcomeEmailSchema = z.object({
  user_to: z.object({
    email: z.string().email("Email inválido"),
    name: z.string().min(1, "Nombre requerido"),
    org_logo: z.string().optional(),
  }),
});

export type CreateUserPayload = z.infer<typeof CreateUserSchema>;
export type OrganizationMembershipPayload = z.infer<
  typeof OrganizationMembershipSchema
>;
export type SuperUserAssignmentPayload = z.infer<
  typeof SuperUserAssignmentSchema
>;
export type CompanyAssignmentPayload = z.infer<typeof CompanyAssignmentSchema>;
export type WelcomeEmailPayload = z.infer<typeof WelcomeEmailSchema>;
