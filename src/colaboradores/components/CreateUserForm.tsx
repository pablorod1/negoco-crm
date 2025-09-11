"use client";
import React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { ROLES } from "@/colaboradores/constants/colaborador.constants";
import { useUser } from "@/core/contexts/UserContext";
import { showCustomToast } from "@/core/components/CustomToast";
import { Info, UserRoundX } from "lucide-react";
import {
  InputComponent,
  SelectComponent,
} from "@/tramites/components/createTramite/InputComponent";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { useUserCreation } from "@/colaboradores/hooks/useUserCreation";
import { CreateUserSchema } from "@/colaboradores/schemas";

interface FormData {
  email: string;
  password: string;
  name: string;
  role: string;
  super_id: string;
  company: string | null;
}

const initialFormState: FormData = {
  email: "",
  password: "",
  name: "",
  role: "2",
  super_id: "",
  company: null,
};

export interface Comercial {
  id: string;
  name: string;
}

export default function CreateUserForm({
  onUserCreated,
  onClose,
}: {
  onUserCreated: () => void;
  onClose: () => void;
}) {
  const { userData, getPlan } = useUser();
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [comerciales, setComerciales] = useState<Comercial[]>([]);
  const [selectedSubcomercial, setSelectedSubcomercial] = useState<string>("");
  const isStarterPlan = getPlan() === "starter";

  const { loading, loadingStep, loadingMessage, submitUserCreation } =
    useUserCreation({
      userData: userData!,
      onSuccess: onUserCreated,
    });

  const fetchComerciales = useCallback(async () => {
    if (!userData) return;
    const res = await fetch(
      `/api/v2/users/${userData.id}/all?role=${userData.role}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const { success, data } = await res.json();

    if (!success) {
      console.error("Error fetching comerciales");
    }

    if (data) {
      setComerciales(data);
    }
  }, [userData]);

  useEffect(() => {
    fetchComerciales();
  }, [fetchComerciales]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (
    value: string,
    e: React.ChangeEvent<HTMLSelectElement>,
    name: string
  ) => {
    if (e) e.preventDefault();
    setFormData((prev) => {
      if (name === "super_id") {
        const comercial = comerciales.find(
          (comercial) => comercial.id === value
        );
        if (comercial) setSelectedSubcomercial(comercial.name);
        return {
          ...prev,
          super_id: value,
        };
      } else {
        return {
          ...prev,
          [name]: value,
        };
      }
    });
  };

  const validateFields = () => {
    try {
      CreateUserSchema.parse({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role as "admin" | "1" | "2",
        company: formData.company,
      });
      return true;
    } catch {
      showCustomToast({
        title: "Datos inválidos",
        message: "Por favor, verifica todos los campos obligatorios",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: UserRoundX,
      });
      return false;
    }
  };

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!validateFields()) return;

    await submitUserCreation({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role as "admin" | "1" | "2",
      company: formData.company,
      super_id: formData.super_id || undefined,
    });
  };

  const handleClose = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onClose();
  };

  return (
    <>
      {loading && (
        <LoadingStateModal
          title={
            loadingStep <= 1
              ? "Validando datos"
              : loadingStep === 2
                ? "Creando usuario"
                : loadingStep === 3
                  ? "Añadiendo a la organización"
                  : loadingStep === 4
                    ? "Asignando jefe de equipo"
                    : loadingStep === 5
                      ? "Asignando empresa"
                      : loadingStep === 6
                        ? "Enviando email de bienvenida"
                        : "Completando proceso"
          }
          description={loadingMessage || "Por favor, espera..."}
        />
      )}
      <form className="space-y-4 w-full">
        {/* Información básica */}
        <div className="space-y-4">
          <InputComponent
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            isRequired
            label="Nombre completo"
          />

          <InputComponent
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            isRequired
            label="Correo electrónico"
          />

          <InputComponent
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            isRequired
            label="Contraseña"
          />
        </div>

        {/* Configuración de rol */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <SelectComponent
            name="role"
            isRequired
            selectedKey={
              formData.role === "admin"
                ? "Dirección"
                : ROLES[parseInt(formData.role)]
            }
            onChange={(value, e) =>
              handleSelectChange(
                ROLES.indexOf(value as (typeof ROLES)[number]).toString(),
                e as React.ChangeEvent<HTMLSelectElement>,
                "role"
              )
            }
            label="Rol del usuario"
            items={[...ROLES]}
          />

          {!isStarterPlan && formData.role === "2" && (
            <SelectComponent
              name="super_id"
              label="Jefe de equipo"
              onChange={(value, e) =>
                handleSelectChange(
                  value,
                  e as React.ChangeEvent<HTMLSelectElement>,
                  "super_id"
                )
              }
              selectedKey={selectedSubcomercial}
              items={comerciales}
            />
          )}

          <div className="space-y-2">
            <InputComponent
              label="Empresa externa"
              name="company"
              type="text"
              value={formData.company || ""}
              onChange={handleChange}
            />
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <Info size={12} className="mt-0.5 text-gray-400" />
              <p>
                Opcional: Solo si el usuario pertenece a una empresa externa
              </p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-gray-900 hover:bg-gray-800"
            disabled={loading}
          >
            {loading ? "Creando..." : "Crear usuario"}
          </Button>
        </div>
      </form>
    </>
  );
}
