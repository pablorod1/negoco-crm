import { formatDate } from "@/lib/core/format";
import Link from "next/link";

interface RenewableTramite {
  id: string;
  renovationDate: string;
  sales_name: string;
}

export default function TramiteRenovable({
  tramite,
}: {
  tramite: RenewableTramite;
}) {
  return (
    <Link
      href={`/tramites?id=${tramite.id}`}
      className="flex items-center gap-4 px-4 py-2 relative border border-gray-100 backdrop-blur-lg shadow-[0_0_6px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.16)] rounded-xl bg-white transition-shadow duration-300"
    >
      <div className="flex items-start justify-between w-full">
        <div className="flex flex-col">
          <span className="font-semibold text-[var(--primary-color-800)] text-lg">
            {tramite.id}
          </span>
          <span className="font-medium text-[var(--primary-color-400)] text-sm">
            Fecha renovación: {formatDate(tramite.renovationDate)}
          </span>
        </div>
        <span className="font-semibold text-[var(--primary-color-800)] text-lg">
          {tramite.sales_name}
        </span>
      </div>
    </Link>
  );
}
