"use client";

import { Mail, Phone, FileText, Calendar, ChevronRight } from "lucide-react";
import { Card } from "@/core/components/ui/card";
import { ClientListItem } from "./ClientsList";
import { useTransitionRouter } from "next-view-transitions";
import { Avatar, AvatarFallback } from "@/core/components/ui/avatar";

export function ClientCard({ client }: { client: ClientListItem }) {
  const router = useTransitionRouter();

  const getInitials = (name: string, lastName: string) => {
    return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getAvatarColor = (id: string) => {
    const colors = [
      "bg-blue-50 text-blue-700",
      "bg-green-50 text-green-700",
      "bg-purple-50 text-purple-700",
      "bg-orange-50 text-orange-700",
      "bg-pink-50 text-pink-700",
      "bg-indigo-50 text-indigo-700",
    ];
    const index = Number.parseInt(id, 16) % colors.length;
    return colors[index];
  };

  return (
    <Card className="group cursor-pointer hover:shadow-md transition-all duration-200 border-gray-200 bg-white">
      <div
        className="p-6"
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/clientes/${client.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`/clientes/${client.id}`);
          }
        }}
      >
        {/* Header with avatar and name */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar className={`h-10 w-10 ${getAvatarColor(client.id)}`}>
            <AvatarFallback className="font-medium">
              {getInitials(client.name, client.last_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
              {client.name} {client.last_name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {client.document_type} {client.document_number}
            </p>
          </div>

          <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Contact info */}
        <div className="space-y-2 mb-4">
          {client.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}

          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Calendar className="h-3.5 w-3.5" />
            <span>{client.tramites_count || 0}</span>
            <span className="text-gray-400">trámites</span>
          </div>

          <div className="flex items-center gap-1 text-sm text-gray-600">
            <FileText className="h-3.5 w-3.5" />
            <span>{client.files_count || 0}</span>
            <span className="text-gray-400">archivos</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
