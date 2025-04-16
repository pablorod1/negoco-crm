"use client";
import AvatarComponent from "@/components/core/AvatarComponent";
import { User } from "@/lib/core/types";
import { Button } from "@/components/ui/button";
import { CircleX, Copy, UserPen } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectComponent } from "../../createTramite/InputComponent";
import { showCustomToast } from "@/components/core/CustomToast";
import { copyLink } from "@/lib/core/utils";
import TooltipComponent from "@/components/core/TooltipComponent";

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
        const res = await fetch(`/api/users/get/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: userData.id,
            role: userData.role,
          }),
        });
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
      const res = await fetch(`/api/tramites/update/sales_person`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tramite_id: tramite_id,
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
    <div className="space-y-2">
      <p className="text-sm font-medium text-primary-400">Comercial</p>

      <div className="flex justify-between items-end gap-4">
        {!isEditMode ? (
          <div className="flex items-center gap-3">
            <AvatarComponent
              userData={user as User}
              className="!rounded-full"
            />
            <div>
              <p className="font-medium">{user.name}</p>
              <TooltipComponent
                content={
                  <div className="flex items-center gap-2">
                    <span>{user.email}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyLink(user.email as string)}
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                }
              >
                <p className="text-sm text-muted-foreground block xl:max-w-44 2xl:max-w-none overflow-hidden text-ellipsis whitespace-nowrap w-full">
                  {user.email}
                </p>
              </TooltipComponent>
            </div>
          </div>
        ) : (
          <SelectComponent
            name="sales_person"
            label="Comercial"
            items={comerciales}
            selectedKey={user.id as string}
            textValue={user.name}
            onChange={handleChange}
          />
        )}
        {isEditable && (
          <Button
            variant={isEditMode ? "destructive" : "default"}
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {!isEditMode ? (
              <UserPen size={16} />
            ) : (
              <CircleX size={16} className="text-danger-500" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
