"use client";
import React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { ROLES } from "@/lib/core/const";
import { useUser } from "@/lib/contexts/UserContext";
import { showCustomToast } from "../core/CustomToast";
import { Info, UserRoundCheck, UserRoundX } from "lucide-react";
import {
  InputComponent,
  SelectComponent,
} from "../tramites/createTramite/InputComponent";

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

type Role = "admin" | "1" | "2";

export default function CreateUserForm({
  onUserCreated,
  onClose,
}: {
  onUserCreated: () => void;
  onClose: () => void;
}) {
  const { userData } = useUser();
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [comerciales, setComerciales] = useState<Comercial[]>([]);
  const [selectedSubcomercial, setSelectedSubcomercial] = useState<string>("");

  const fetchComerciales = useCallback(async () => {
    const res = await fetch(`/api/users/get/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: userData?.id, role: userData?.role }),
    });
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

  const addUserToOrganization = async (
    userId: string,
    organizationId: string
  ) => {
    await fetch("/api/users/add/member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        organizationId,
        role: formData.role,
      }),
    });
  };

  const addExternalCompany = async ({
    id,
    company,
  }: {
    id: string;
    company: string;
  }) => {
    try {
      const res = await fetch("/api/users/add/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          company,
        }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al asignar empresa",
          message: error,
          icon: UserRoundX,
          iconColor: "red",
          iconSize: 24,
          duration: 3000,
        });
        return;
      }
    } catch (error) {
      console.error("Error adding company to user:", error);
      showCustomToast({
        title: "Error al asignar empresa",
        message: "Inténtalo de nuevo más tarde",
        icon: UserRoundX,
        iconColor: "red",
        iconSize: 24,
        duration: 3000,
      });
    }
  };

  const validateFields = () => {
    const { email, password, name, role } = formData;
    if (!email || !password || !name || !role) {
      showCustomToast({
        title: "Error",
        message: "Por favor, rellena todos los campos obligatorios",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: UserRoundX,
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!validateFields()) return;
    setIsLoading(true);

    try {
      const { data, error } = await authClient.admin.createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role as Role,
      });

      if (error) {
        showCustomToast({
          title: "Error al crear el usuario",
          message: error.message,
          icon: UserRoundX,
          iconColor: "red",
          iconSize: 24,
          duration: 3000,
        });
        setIsLoading(false);
        return;
      }

      if (data?.user.id && userData) {
        // const updatedUser = await authClient.admin.setRole({
        //   userId: data.user.id,
        //   role: formData.role === "0" ? "admin" : (formData.role as Role),
        // });

        // if (updatedUser.error) {
        //   showCustomToast({
        //     title: "Error al actualizar el rol",
        //     message: updatedUser.error.message,
        //     icon: UserRoundX,
        //     iconColor: "red",
        //     iconSize: 24,
        //     duration: 3000,
        //   });
        //   setIsLoading(false);
        //   return;
        // }

        await addUserToOrganization(
          data.user.id,
          userData.organization.id as string
        );

        if (formData.super_id) {
          const res = await fetch("/api/users/add/super", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: data.user.id,
              super_id: formData.super_id,
            }),
          });

          const { success, error } = await res.json();

          if (!success && error) {
            showCustomToast({
              title: "Error al asignar comercial",
              message: error,
              icon: UserRoundX,
              iconColor: "red",
              iconSize: 24,
              duration: 3000,
            });
            setIsLoading(false);
            return;
          }
        }

        if (formData.company) {
          await addExternalCompany({
            id: data.user.id,
            company: formData.company,
          });
        }

        const emailRes = await fetch("/api/send-email/welcome", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_to: {
              email: formData.email,
              name: formData.name,
              org_logo: userData.organization.logo,
            },
          }),
        });

        const { success, error } = await emailRes.json();

        if (!success && error) {
          showCustomToast({
            title: "Error al enviar el email",
            message: error,
            icon: UserRoundX,
            iconColor: "red",
            iconSize: 24,
            duration: 3000,
          });
          setIsLoading(false);
          return;
        }

        showCustomToast({
          title: "Nuevo usuario creado",
          message: `El usuario ${
            formData.name
          } ha sido creado exitosamente con el rol de ${
            ROLES[parseInt(formData.role)]
          }`,
          icon: UserRoundCheck,
          iconColor: "green",
          iconSize: 24,
          duration: 3000,
        });
        onUserCreated();
      }
    } catch (error) {
      showCustomToast({
        title: "Error al crear el usuario",
        message: "Inténtalo de nuevo más tarde",
        icon: UserRoundX,
        iconColor: "red",
        iconSize: 24,
        duration: 3000,
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onClose();
  };

  return (
    <form className="space-y-6 w-full py-2">
      <InputComponent
        type="text"
        name="name"
        value={formData.name}
        onChange={handleChange}
        isRequired
        label="Nombre"
      />

      <InputComponent
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        isRequired
        label="Correo Electrónico"
      />

      <div className="flex flex-col gap-2">
        <InputComponent
          label="Empresa"
          name="company"
          type="text"
          value={formData.company || ""}
          onChange={handleChange}
        />
        <div className="flex items-start gap-1 text-xs text-muted-foreground">
          <Info size={12} className="mt-0.5" />
          <p>
            Dejar en blanco si el usuario no pertenece a ninguna empresa externa
          </p>
        </div>
      </div>

      <InputComponent
        name="password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        isRequired
        label="Contraseña"
      />

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
            ROLES.indexOf(value).toString(),
            e as React.ChangeEvent<HTMLSelectElement>,
            "role"
          )
        }
        label="Rol"
        items={ROLES}
      />

      {formData.role === "2" && (
        <SelectComponent
          name="super_id"
          label="Comercial"
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

      <div className="flex justify-between items-center gap-2">
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleClose}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button onClick={handleSubmit} className="w-full" disabled={isLoading}>
          {isLoading ? "Creando usuario..." : "Crear Usuario"}
        </Button>
      </div>
    </form>
  );
}
