import { showCustomToast } from "@/components/core/CustomToast";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { User } from "@/lib/core/types";
import { CircleX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Props {
  userFilter: string[] | undefined;
  setUserFilter: (value: string[] | undefined) => void;
  isComercial: boolean;
  userData: User;
}

interface UserOption {
  value: string;
  label: string;
  icon?: string;
}

export default function UserFilter({
  userFilter,
  setUserFilter,
  isComercial,
  userData,
}: Props) {
  const [comerciales, setComerciales] = useState<UserOption[]>([]);

  const fetchComerciales = useCallback(async () => {
    if (isComercial || !userData) {
      return;
    }
    try {
      const res = await fetch(`/api/users/get/${userData.id}/all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: userData.role,
          id: userData.id,
        }),
      });

      const { success, error, data } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      const options = data.map((user: User) => ({
        value: user.id,
        label: user.name,
        icon: user.image || undefined,
      }));
      setComerciales(options);
    } catch (error) {
      console.error("Error al obtener comerciales:", error);
      showCustomToast({
        title: "Error",
        message: "Error al obtener comerciales",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  }, [isComercial, userData]);

  // Fetch comerciales when the component mounts or when isComercial changes
  useEffect(() => {
    fetchComerciales();
  }, [fetchComerciales]);
  return (
    <div className="space-y-2">
      <Label>Comercial</Label>

      <MultiSelect
        options={comerciales}
        onValueChange={setUserFilter}
        placeholder="Seleccionar comercial"
        value={userFilter}
        maxCount={2}
        variant="primary"
        defaultValue={userFilter}
      />
    </div>
  );
}
