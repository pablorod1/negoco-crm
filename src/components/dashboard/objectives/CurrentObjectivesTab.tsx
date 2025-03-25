import { Objective } from "@/lib/core/types";
import { ObjetivosAnimatedList } from "./ObjetivosAnimatedList";

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
