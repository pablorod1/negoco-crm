"use client";
import type { ClientListItem } from "./ClientsList";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/core/components/ui/table";
import { ChevronRight, Mail, Phone, FileText, Calendar } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { Avatar, AvatarFallback } from "@/core/components/ui/avatar";

interface ClientsTableProps {
  clients: ClientListItem[];
  isLoading?: boolean;
}

export function ClientsTable({
  clients,
  isLoading = false,
}: ClientsTableProps) {
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

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100">
              <TableHead className="text-gray-600 font-medium">
                Cliente
              </TableHead>
              <TableHead className="text-gray-600 font-medium hidden md:table-cell">
                Contacto
              </TableHead>
              <TableHead className="text-gray-600 font-medium text-center hidden sm:table-cell">
                Actividad
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array(5)
              .fill(0)
              .map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={4}>
                    <div className="h-16 bg-gray-50 animate-pulse rounded-md"></div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-100">
            <TableHead className="text-gray-600 font-medium py-4">
              Cliente
            </TableHead>
            <TableHead className="text-gray-600 font-medium hidden md:table-cell">
              Contacto
            </TableHead>
            <TableHead className="text-gray-600 font-medium text-center hidden sm:table-cell">
              Actividad
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow
              key={client.id}
              className="group cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
              onClick={() => router.push(`/clientes/${client.id}`)}
            >
              <TableCell className="py-4">
                <div className="flex items-center gap-3">
                  <Avatar className={`h-8 w-8 ${getAvatarColor(client.id)}`}>
                    <AvatarFallback className="text-xs font-medium">
                      {getInitials(client.name, client.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-gray-900">
                      {client.name} {client.last_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {client.document_type} {client.document_number}
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <div className="space-y-1">
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <span className="truncate max-w-[200px]">
                        {client.email}
                      </span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                </div>
              </TableCell>

              <TableCell className="hidden sm:table-cell">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span>{client.tramites_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                    <span>{client.files_count || 0}</span>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
