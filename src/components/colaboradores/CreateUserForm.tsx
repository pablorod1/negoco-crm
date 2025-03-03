import React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, SelectItem } from "@heroui/react";
import { auth } from "@/lib/auth/auth";
import { authClient } from "@/lib/auth/auth-client";
import { ROLES } from "@/lib/core/const";
import { useUser } from "@/contexts/UserContext";
import { getUsers } from "@/lib/libsql/data/colaboradores/getUsers";
import { addSuperToUser } from "@/lib/libsql/data/auth/updateUser";
import { showCustomToast } from "../core/CustomToast";
import { UserRoundCheck, UserRoundX } from "lucide-react";

interface FormData {
  email: string;
  password: string;
  name: string;
  role: string;
  super_id: string;
}

const initialFormState: FormData = {
  email: "",
  password: "",
  name: "",
  role: "2",
  super_id: "",
};

interface Comercial {
  id: string;
  name: string;
}

export default function CreateUserForm({
  onUserCreated,
}: {
  onUserCreated: () => void;
}) {
  const { userData } = useUser();
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [comerciales, setComerciales] = useState<Comercial[]>([]);

  const fetchComerciales = useCallback(async () => {
    const { data, success } = await getUsers(userData);

    if (!success) {
      console.error("Error fetching comerciales");
    }

    if (data) {
      setComerciales(
        data.map((comercial) => ({
          id: comercial.id,
          name: comercial.name,
        }))
      );
    }
  }, [userData]);

  useEffect(() => {
    fetchComerciales();
  }, [fetchComerciales]);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addUserToOrganization = async (
    userId: string,
    organizationId: string
  ) => {
    await auth.api.addMember({
      body: {
        userId,
        organizationId,
        role: "member",
      },
    });
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await authClient.admin.createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: "user",
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
        const updatedUser = await authClient.admin.setRole({
          userId: data.user.id,
          role: formData.role === "0" ? "admin" : formData.role.toString(),
        });

        if (updatedUser.error) {
          showCustomToast({
            title: "Error al actualizar el rol",
            message: updatedUser.error.message,
            icon: UserRoundX,
            iconColor: "red",
            iconSize: 24,
            duration: 3000,
          });
          setIsLoading(false);
          return;
        }

        await addUserToOrganization(
          data.user.id,
          userData.organization.id as string
        );

        if (formData.super_id) {
          const { success, error } = await addSuperToUser(
            data.user.id,
            formData.super_id
          );

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

  return (
    <form className="space-y-6 w-full">
      <Input
        id="name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        isRequired
        label="Nombre"
        placeholder="Ingrese el nombre"
        className="w-full"
      />

      <Input
        id="email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        isRequired
        label="Correo Electrónico"
        placeholder="correo@ejemplo.com"
        className="w-full"
      />

      <Input
        id="password"
        name="password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        isRequired
        label="Contraseña"
        placeholder="••••••••"
        className="w-full"
      />

      <Select
        name="role"
        isRequired
        selectedKeys={[formData.role]}
        onChange={handleChange}
        label="Rol"
      >
        {ROLES.map((role, index) => (
          <SelectItem key={index} value={index}>
            {role}
          </SelectItem>
        ))}
      </Select>

      {formData.role === "2" && (
        <Select
          name="super_id"
          label="Comercial"
          onChange={handleChange}
          selectedKeys={[formData.super_id]}
        >
          {comerciales.map((item) => (
            <SelectItem key={item.id} value={item.id} textValue={item.name}>
              {item.name}
            </SelectItem>
          ))}
        </Select>
      )}

      <Button onClick={handleSubmit} className="w-full" disabled={isLoading}>
        {isLoading ? "Creando usuario..." : "Crear Usuario"}
      </Button>
    </form>
  );
}
