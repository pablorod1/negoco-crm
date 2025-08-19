"use client";

import {
  Calendar,
  ChevronDown,
  FileText,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Card } from "@/core/components/ui/card";
import { ClientListItem } from "./ClientsList";
import { useTransitionRouter } from "next-view-transitions";
import { Avatar, AvatarFallback } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";

export function ClientCard({ client }: { client: ClientListItem }) {
  const router = useTransitionRouter();

  const getInitials = (name: string, lastName: string) => {
    return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getAvatarColor = (id: string) => {
    const colors = [
      "bg-red-100 text-red-800",
      "bg-blue-100 text-blue-800",
      "bg-green-100 text-green-800",
      "bg-yellow-100 text-yellow-800",
      "bg-purple-100 text-purple-800",
      "bg-pink-100 text-pink-800",
      "bg-indigo-100 text-indigo-800",
      "bg-teal-100 text-teal-800",
    ];
    const index = Number.parseInt(id, 16) % colors.length;
    return colors[index];
  };

  return (
    <Card
      key={client.id}
      className="overflow-hidden transition-all duration-200 hover:shadow-md group"
    >
      <div
        className="p-6 cursor-pointer"
        onClick={() => router.push(`/clientes/${client.id}`)}
      >
        <div className="flex items-start gap-4">
          <Avatar
            className={`h-12 w-12 ring-2 ring-background ${getAvatarColor(client.id)}`}
          >
            <AvatarFallback>
              {getInitials(client.name, client.last_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-lg truncate group-hover:text-primary transition-colors">
                {client.name} {client.last_name}
              </h3>
            </div>

            <div className="mt-1 flex items-center">
              <Badge variant="outline" className="font-normal text-xs">
                {client.document_type} {client.document_number}
              </Badge>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              {client.email && (
                <div className="flex items-center text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}

              {client.phone && (
                <div className="flex items-center text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground">Trámites</span>
              <div className="flex items-center mt-1">
                <Calendar className="h-3.5 w-3.5 mr-1 text-primary" />
                <span className="font-medium">
                  {client.tramites_count || 0}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground">Archivos</span>
              <div className="flex items-center mt-1">
                <FileText className="h-3.5 w-3.5 mr-1 text-primary" />
                <span className="font-medium">{client.files_count || 0}</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/clientes/${client.id}`);
            }}
          >
            Ver detalles
            <ChevronDown className="ml-1 h-4 w-4 rotate-[-90deg]" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
