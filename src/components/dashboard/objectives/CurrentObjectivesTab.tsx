import { Objective } from "@/lib/core/types";
import { ObjetivosAnimatedList } from "./ObjetivosAnimatedList";
import Image from "next/image";

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
              No tienes objetivos establecidos
            </h2>
            <p className="text-center text-gray-500 text-sm italic">
              No tienes objetivos establecidos. Crea tu primer objetivo para
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
