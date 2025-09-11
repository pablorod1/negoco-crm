import { Objective } from "@/dashboard/types";
import { ObjetivosAnimatedList } from "./ObjetivosAnimatedList";
import { Target } from "lucide-react";

interface Props {
  objetivos: Objective[];
  setOpen: (open: boolean) => void;
  setEditingObjetivo: (objetivo: Objective) => void;
  setNewObjetivo: (objetivo: Objective) => void;
}

export default function CurrentObjectivesTab({
  objetivos,
  setOpen,
  setEditingObjetivo,
  setNewObjetivo,
}: Props) {
  const handleEditObjetivo = (objetivo: Objective) => {
    setEditingObjetivo(objetivo);
    setNewObjetivo(objetivo);
    setOpen(true);
  };

  return (
    <>
      {objetivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Target className="h-8 w-8 text-gray-400" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-lg font-medium text-gray-900">
              No hay objetivos establecidos
            </h3>
            <p className="text-sm text-gray-500">
              Crea tu primer objetivo para comenzar el seguimiento
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
