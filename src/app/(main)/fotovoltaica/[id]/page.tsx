"use client";
import { FotovoltaicaDetailView } from "@/components/fotovoltaica/details/FotovoltaicaDetailView";
import { useParams } from "next/navigation";

export default function FotovoltaicaDetailPage() {
  const params = useParams();
  const { id } = params;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <FotovoltaicaDetailView id={id as string} />
    </div>
  );
}
