"use client";

import { Plus } from "lucide-react";
import { Card, CardTitle } from "../ui/card";

export default function AddTramiteCard() {
  return (
    <button className="w-full max-w-xs">
      <Card className="py-4 px-8 w-full hover:bg-[var(--primary-color-50)]">
        <div className="flex items-center justify-between">
          <CardTitle>
            <h3 className="text-xl text-gray-800">Añadir Trámite</h3>
          </CardTitle>
          <Plus className="w-8 h-8 text-[var(--primary-color-500)]" />
        </div>
      </Card>
    </button>
  );
}
