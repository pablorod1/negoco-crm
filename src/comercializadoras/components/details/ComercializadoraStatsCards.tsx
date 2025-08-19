"use client";

import { ClipboardList, FileText } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";

interface ComercializadoraStatsCardsProps {
  numTramites: number;
  numFiles: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-2">
          {icon}
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComercializadoraStatsCards({
  numTramites,
  numFiles,
}: ComercializadoraStatsCardsProps) {
  return (
    <div className="space-y-4">
      <StatCard
        icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
        label="Trámites Activos"
        value={numTramites}
      />
      <StatCard
        icon={<FileText className="h-5 w-5 text-green-600" />}
        label="Documentos"
        value={numFiles}
      />
    </div>
  );
}

