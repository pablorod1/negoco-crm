import { useState, useCallback } from "react";
import { authClient } from "@/core/auth/auth-client";
import { showCustomToast } from "@/core/components/CustomToast";
import { UserRoundCheck, UserRoundX } from "lucide-react";
import { ROLES } from "@/colaboradores/constants/colaborador.constants";
import {
  CreateUserSchema,
  OrganizationMembershipSchema,
  SuperUserAssignmentSchema,
  CompanyAssignmentSchema,
  WelcomeEmailSchema,
  type CreateUserPayload,
} from "@/colaboradores/schemas";

interface UseUserCreationProps {
  userData: {
    id: string;
    organization: {
      id: string;
      logo?: string | null;
    };
  };
  onSuccess: () => void;
}

export function useUserCreation({ userData, onSuccess }: UseUserCreationProps) {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");

  const validateUserData = useCallback((formData: CreateUserPayload) => {
    try {
      CreateUserSchema.parse(formData);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }, []);

  const createUser = useCallback(async (userPayload: CreateUserPayload) => {
    const { data, error } = await authClient.admin.createUser({
      name: userPayload.name,
      email: userPayload.email,
      password: userPayload.password,
      role: userPayload.role as "admin" | "1" | "2",
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }, []);

  const addToOrganization = useCallback(
    async (userId: string, organizationId: string, role: string) => {
      try {
        OrganizationMembershipSchema.parse({ userId, organizationId, role });
      } catch {
        throw new Error("Datos de membresía inválidos");
      }
      const response = await fetch(
        `/api/v2/users/${userId}/organization-membership`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, organizationId, role }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Error adding user to organization");
      }

      return result;
    },
    []
  );

  const assignSuperUser = useCallback(
    async (userId: string, superId: string) => {
      try {
        SuperUserAssignmentSchema.parse({ super_id: superId });
      } catch {
        throw new Error("ID de jefe de equipo inválido");
      }
      const response = await fetch(`/api/v2/users/${userId}/super`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ super_id: superId }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Error assigning super user");
      }

      return result;
    },
    []
  );

  const assignCompany = useCallback(async (userId: string, company: string) => {
    try {
      CompanyAssignmentSchema.parse({ company });
    } catch {
      throw new Error("Nombre de empresa inválido");
    }

    const response = await fetch(`/api/v2/users/${userId}/company`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Error assigning company");
    }

    return result;
  }, []);

  const sendWelcomeEmail = useCallback(
    async (email: string, name: string, orgLogo?: string) => {
      try {
        WelcomeEmailSchema.parse({
          user_to: { email, name, org_logo: orgLogo },
        });
      } catch {
        throw new Error("Datos de email inválidos");
      }
      const response = await fetch("/api/v2/communications/emails/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_to: { email, name, org_logo: orgLogo },
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Error sending welcome email");
      }

      return result;
    },
    []
  );

  const submitUserCreation = useCallback(
    async (formData: CreateUserPayload & { super_id?: string }) => {
      setLoading(true);
      try {
        // Step 1: Validate data
        setLoadingStep(1);
        setLoadingMessage("Validando datos");
        const validation = validateUserData(formData);
        if (!validation.success) {
          showCustomToast({
            title: "Datos inválidos",
            message: "Por favor, revisa todos los campos obligatorios",
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: UserRoundX,
          });
          return;
        }

        // Step 2: Create user
        setLoadingStep(2);
        setLoadingMessage("Creando usuario");
        const createdUserData = await createUser(formData);

        if (!createdUserData?.user?.id) {
          throw new Error("No se pudo crear el usuario");
        }

        const userId = createdUserData.user.id;

        // Step 3: Add to organization - CRITICAL FIX
        setLoadingStep(3);
        setLoadingMessage("Añadiendo a la organización");
        if (!userData?.organization?.id) {
          throw new Error("ID de organización no encontrado");
        }

        // Convert role number to organization role
        const orgRole = formData.role === "admin" ? "admin" : "member";
        await addToOrganization(userId, userData.organization.id, orgRole);

        // Step 4: Assign super user (optional)
        if (formData.super_id) {
          setLoadingStep(4);
          setLoadingMessage("Asignando jefe de equipo");
          await assignSuperUser(userId, formData.super_id);
        }

        // Step 5: Assign company (optional)
        if (formData.company) {
          setLoadingStep(5);
          setLoadingMessage("Asignando empresa");
          await assignCompany(userId, formData.company);
        }

        // Step 6: Send welcome email
        setLoadingStep(6);
        setLoadingMessage("Enviando email de bienvenida");
        await sendWelcomeEmail(
          formData.email,
          formData.name,
          userData.organization?.logo || undefined
        ); // Success
        setLoadingStep(7);
        setLoadingMessage("Completado");
        showCustomToast({
          title: "Usuario creado exitosamente",
          message: `${formData.name} ha sido creado con el rol de ${
            ROLES[parseInt(formData.role === "admin" ? "0" : formData.role)]
          }`,
          icon: UserRoundCheck,
          iconColor: "green",
          iconSize: 24,
          duration: 3000,
        });

        onSuccess();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";
        showCustomToast({
          title: "Error al crear usuario",
          message,
          icon: UserRoundX,
          iconColor: "red",
          iconSize: 24,
          duration: 5000,
        });
        console.error("User creation error:", error);
      } finally {
        setLoading(false);
        setLoadingStep(0);
        setLoadingMessage("");
      }
    },
    [
      validateUserData,
      createUser,
      addToOrganization,
      assignSuperUser,
      assignCompany,
      sendWelcomeEmail,
      onSuccess,
      userData.organization.id,
      userData.organization?.logo,
    ]
  );

  return {
    loading,
    loadingStep,
    loadingMessage,
    submitUserCreation,
  };
}
