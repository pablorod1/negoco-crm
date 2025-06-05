import { FotovoltaicaVM } from "@/lib/core/types";
import FotovoltaicaPublicNotes from "./FotovoltaicaPublicNotes";
import FotovoltaicaInternalNotes from "./FotovoltaicaInternalNotes";
import { cn } from "@/lib/utils";

interface Props {
  fotovoltaica: FotovoltaicaVM;
  onSubmit: () => void;
  isComercial: boolean;
}

export default function FotovoltaicaNotesTab({
  fotovoltaica,
  onSubmit,
  isComercial,
}: Props) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        isComercial ? "md:grid-cols-1" : "md:grid-cols-2"
      )}
    >
      {/* Notas Públicas */}
      <FotovoltaicaPublicNotes
        fotovoltaica={fotovoltaica}
        onSubmit={onSubmit}
      />

      {/* Notas Internas */}
      {!isComercial ? (
        <FotovoltaicaInternalNotes
          fotovoltaica={fotovoltaica}
          onSubmit={onSubmit}
        />
      ) : null}
    </div>
  );
}
