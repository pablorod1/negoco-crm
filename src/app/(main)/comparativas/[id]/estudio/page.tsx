"use client";

import { useParams } from "next/navigation";
import { StudyWorkspace } from "@/comparador/components/study/StudyWorkspace";

/** El comparador propio a pantalla completa, para una comparativa. */
export default function ComparativaStudyPage() {
  const { id } = useParams<{ id: string }>();
  return <StudyWorkspace comparativaId={id} />;
}
