import { Objective, User } from "@/lib/core/types";
import { ObjetivosAnimatedList } from "./ObjetivosAnimatedList";
import { useCallback, useEffect, useState } from "react";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleX } from "lucide-react";
import Image from "next/image";

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
        <div className="flex flex-col justify-center items-center w-full py-8 gap-4 h-72">
          <Image
            src="/icons/objetivo2.webp"
            alt="Objetivos"
            width={64}
            height={64}
            className="w-auto h-auto aspect-[512/512]"
          />
          <div className="flex flex-col gap-1 items-center justify-center">
            <h2 className="text-xl font-bold text-gray-600">
              Historial de Objetivos
            </h2>
            <p className="text-center text-gray-500 text-sm italic">
              No tienes objetivos completados. Crea tu primer objetivo para
              comenzar a hacer seguimiento.
            </p>
          </div>
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
