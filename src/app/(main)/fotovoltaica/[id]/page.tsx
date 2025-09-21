"use client";
import { FotovoltaicaDetailView } from "@/fotovoltaica/components/details/FotovoltaicaDetailView";
import { useParams } from "next/navigation";

export default function FotovoltaicaDetailPage() {
  const params = useParams();
  const { id } = params;

  return <FotovoltaicaDetailView id={id as string} />;
}
