import { Building2 } from "lucide-react";
import Image from "next/image";

import { ComercializadoraVM } from "@/comercializadoras/types";
import {
  companyLogoUrl,
  isUnoptimizedLogo,
} from "@/comercializadoras/lib/logo-url";
import { cn } from "@/core/utils";

interface SupplierLogoProps {
  supplier: Pick<ComercializadoraVM, "name" | "logo">;
  /** Tamaño en píxeles del cuadro que contiene el logo. */
  size?: number;
  className?: string;
}

/** Logo de una comercializadora, con edificio de respaldo si no tiene. */
export function SupplierLogo({
  supplier,
  size = 48,
  className,
}: SupplierLogoProps) {
  const logoUrl = companyLogoUrl(supplier.logo);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white",
        className
      )}
      style={{ width: size, height: size, padding: Math.round(size / 8) }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`Logo de ${supplier.name}`}
          width={size * 2}
          height={size * 2}
          className="size-full object-contain"
          loading="lazy"
          unoptimized={isUnoptimizedLogo(supplier.logo)}
        />
      ) : (
        <Building2
          className="text-gray-500"
          style={{ width: size / 2, height: size / 2 }}
        />
      )}
    </div>
  );
}
