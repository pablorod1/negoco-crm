"use client";
import AvatarComponent from "@/core/components/AvatarComponent";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { CircleX, Copy, UserPen } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectComponent } from "../../createTramite/InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { copyLink } from "@/core/utils";
import TooltipComponent from "@/core/components/TooltipComponent";

interface Props {
  userData: User;
  user: Partial<User>;
  isEditable: boolean | null;
  tramite_id: string;
  onUpdate: () => void;
}

export default function TramiteComercialSection({
  user,
  isEditable,
  userData,
  tramite_id,
  onUpdate,
}: Props) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [comerciales, setComerciales] = useState<User[]>([]);

  useEffect(() => {
    const fetchComerciales = async () => {
      try {
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
          return;
        }

        if (data) {
          setComerciales(data as User[]);
        }
      } catch (error) {
        console.error(error);
      }
    };

    if (isEditMode) {
      fetchComerciales();
    }
  }, [isEditMode, userData]);

  const handleChange = async (value: string) => {
    try {
      const selectedComercial = comerciales.find(
        (comercial) => comercial.id === value
      );

      if (!selectedComercial) {
        showCustomToast({
          title: "Error",
          message: "No se ha seleccionado un comercial",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }
      const res = await fetch(`/api/v2/contracts/${tramite_id}/sales-person`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: selectedComercial.id,
          sales_name: selectedComercial.name,
        }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al guardar los cambios",
          message: error as string,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Cambios guardados",
        message: "Los cambios se han guardado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CircleX,
      });

      setIsEditMode(false);
      onUpdate();
    } catch (error) {
      console.error(error);
      showCustomToast({
        title: "Error al guardar los cambios",
        message: error as string,
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Proveedor</h4>
        {isEditable && !isEditMode ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditMode(!isEditMode)}
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <UserPen className="h-4 w-4 mr-2" />
            Cambiar
          </Button>
        ) : null}
      </div>
      {!isEditMode ? (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
          <AvatarComponent userData={user as User} className=" h-12 w-12" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 truncate">{user.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <TooltipComponent
                content={
                  <div className="flex items-center gap-2">
                    <span>{user.email}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyLink(user.email as string)}
                      className="h-6 w-6"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                }
              >
                <p className="text-sm text-gray-500 truncate max-w-64">
                  {user.email}
                </p>
              </TooltipComponent>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => copyLink(user.email as string)}
                className="h-6 w-6 text-gray-400 hover:text-gray-600"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <SelectComponent
            name="sales_person"
            label="Seleccionar nuevo comercial"
            items={comerciales}
            selectedKey={user.id as string}
            textValue={user.name}
            onChange={handleChange}
          />
          <div className="flex gap-2">
            <Button
              variant={"dangerGhost"}
              size="sm"
              onClick={() => setIsEditMode(false)}
            >
              <CircleX className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
