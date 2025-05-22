"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ClientListItem } from "./ClientsList";
import { Link } from "next-view-transitions";

export function ClientCard({ client }: { client: ClientListItem }) {
  const initials =
    `${client.name?.[0] ?? ""}${client.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg border border-gray-200 bg-white/90 rounded-xl">
      <CardContent className="p-0 h-full">
        <div className="flex flex-col justify-between w-full h-full">
          <div className="flex items-start gap-4 p-6 relative">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl border border-primary-200 shadow">
                {initials}
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex justify-between items-center gap-2">
                <h3 className="font-semibold leading-tight text-lg text-gray-800">
                  {client.name} {client.last_name}
                </h3>
                <Badge
                  variant="secondary"
                  className="ml-auto px-2 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700 border border-primary-200"
                >
                  {client.type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{client.phone}</p>
              <p className="text-xs text-gray-500">{client.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x border-t mt-auto bg-gray-50">
            <div className="flex flex-col items-center justify-center p-3">
              <span className="text-xl font-bold text-primary-700">
                {client.tramites_count}
              </span>
              <span className="text-xs text-muted-foreground">Trámites</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3">
              <span className="text-xl font-bold text-primary-700">
                {client.files_count || 0}
              </span>
              <span className="text-xs text-muted-foreground">Archivos</span>
            </div>
            <div className="flex items-center justify-center p-3">
              <Link
                href={`/clientes/${client.id}`}
                className="flex items-center gap-2 hover:underline text-primary-700 text-sm font-medium"
              >
                Ver detalles
                <ExternalLink className="h-4 w-4 text-primary-700" />
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
