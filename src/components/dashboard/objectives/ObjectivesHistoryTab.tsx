import { Objective, User } from "@/lib/core/types";
import { ObjetivosAnimatedList } from "./ObjetivosAnimatedList";
import { useCallback, useEffect, useState } from "react";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleX } from "lucide-react";

interface Props {
  setOpen: (open: boolean) => void;
  setEditingObjetivo: (objetivo: Objective) => void;
  setNewObjetivo: (objetivo: Objective) => void;
  userData: User;
}

export default function ObjectivesHistoryTab({
  setOpen,
  setEditingObjetivo,
  setNewObjetivo,
  userData,
}: Props) {
  const [objetivos, setObjetivos] = useState<Objective[]>([]);
  const handleEditObjetivo = (objetivo: Objective) => {
    setEditingObjetivo(objetivo);
    setNewObjetivo(objetivo);
    setOpen(true);
  };

  const fetchObjetivos = useCallback(async () => {
    try {
      const res = await fetch(`/api/objectives/get/all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: userData.id, role: userData.role }),
      });

      const { success, data, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al obtener objetivos",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
      }

      if (data) {
        setObjetivos(data);
      }
    } catch (error) {
      showCustomToast({
        title: "Error al obtener objetivos",
        message: error as string,
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  }, [userData]);

  useEffect(() => {
    fetchObjetivos();
  }, [fetchObjetivos]);
  return (
    <>
      {objetivos.length === 0 ? (
        <div className="flex flex-col justify-center items-center w-full py-8 gap-2">
          <p className="text-center text-gray-500 text-sm">
            No tienes objetivos establecidos. Crea tu primer objetivo para
            comenzar a hacer seguimiento.
          </p>
        </div>
      ) : (
        <ObjetivosAnimatedList
          items={objetivos}
          handleEditObjetivo={handleEditObjetivo}
        />
      )}
    </>
  );
}
