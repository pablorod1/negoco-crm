"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransitionRouter } from "next-view-transitions";

export function ComercializadoraDetailsHeader() {
  const router = useTransitionRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="sm" onClick={handleBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>
      <div className="h-6 w-px bg-border" />
    </div>
  );
}
