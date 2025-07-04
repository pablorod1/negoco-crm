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
import { Badge } from "@/core/components/ui/badge";
import { ChevronRight, FileText, Inbox, Mail, Phone } from "lucide-react";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { useTransitionRouter } from "next-view-transitions";
import { slideIn } from "@/core/view-transitions/view-transitions";

interface ClientsTableProps {
  clients: ClientListItem[];
  isLoading?: boolean;
}

export function ClientsTable({
  clients,
  isLoading = false,
}: ClientsTableProps) {
  const router = useTransitionRouter();

  if (isLoading) {
    return (
      <div className="rounded-xl border shadow-sm bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>Nombre</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Teléfono</TableHead>
              <TableHead className="text-center hidden sm:table-cell">
                Trámites
              </TableHead>
              <TableHead className="text-center hidden sm:table-cell">
                Archivos
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array(5)
              .fill(0)
              .map((_, index) => (
                <TableRow key={index} className="border-b last:border-b-0">
                  <TableCell colSpan={7}>
                    <div className="h-12 bg-muted/30 animate-pulse rounded-md"></div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border shadow-sm flex flex-col items-center justify-center p-8 text-center bg-background">
        <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No hay clientes</h3>
        <p className="text-sm text-muted-foreground mt-1">
          No se encontraron clientes en el sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border shadow-sm bg-background overflow-hidden">
      <ScrollArea className="h-[calc(100vh-250px)] md:h-auto">
        <Table>
          <TableHeader className="bg-muted/60 sticky top-0 z-10">
            <TableRow>
              <TableHead className="font-semibold text-muted-foreground">
                Nombre
              </TableHead>
              <TableHead className="font-semibold text-muted-foreground">
                Documento
              </TableHead>
              <TableHead className="hidden md:table-cell font-semibold text-muted-foreground">
                Email
              </TableHead>
              <TableHead className="hidden md:table-cell font-semibold text-muted-foreground">
                Teléfono
              </TableHead>
              <TableHead className="text-center hidden sm:table-cell font-semibold text-muted-foreground">
                Trámites
              </TableHead>
              <TableHead className="text-center hidden sm:table-cell font-semibold text-muted-foreground">
                Archivos
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client, idx) => (
              <TableRow
                key={client.id}
                className={`cursor-pointer group hover:bg-primary/10 transition-colors border-b last:border-b-0 ${
                  idx % 2 === 0 ? "bg-muted/10" : "bg-background"
                }`}
                onClick={() =>
                  router.push(`/clientes/${client.id}`, {
                    onTransitionReady: slideIn,
                  })
                }
              >
                <TableCell className="font-semibold">
                  <div className="flex flex-col">
                    <span>
                      {client.name} {client.last_name}
                    </span>
                    <div className="md:hidden flex items-center gap-2 mt-1">
                      {client.email && (
                        <Mail className="h-3 w-3 text-muted-foreground" />
                      )}
                      {client.phone && (
                        <Phone className="h-3 w-3 text-muted-foreground" />
                      )}
                      {(client.tramites_count > 0 ||
                        client.files_count > 0) && (
                        <Badge
                          variant="outline"
                          className="text-xs h-5 px-2 border-primary/40"
                        >
                          {client.tramites_count > 0 &&
                            `${client.tramites_count} trám.`}
                          {client.tramites_count > 0 &&
                            client.files_count > 0 &&
                            ", "}
                          {client.files_count > 0 &&
                            `${client.files_count} arch.`}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="font-normal px-2 py-1 rounded-md bg-muted/30 border-muted-foreground/10">
                    {client.document_type} {client.document_number}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {client.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[150px]">
                        {client.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {client.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{client.phone}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell">
                  {client.tramites_count > 0 ? (
                    <Badge variant="outline" className="border-primary/40">
                      {client.tramites_count}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell">
                  {client.files_count > 0 ? (
                    <div className="flex items-center justify-center">
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1 border-primary/40"
                      >
                        <FileText className="h-3 w-3" />
                        {client.files_count}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

