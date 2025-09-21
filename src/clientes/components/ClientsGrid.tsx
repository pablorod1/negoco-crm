import React from "react";
import { ClientCard } from "./ClientCard";
import { ClientListItem } from "./ClientsList";

interface ClientsGridProps {
  clients: ClientListItem[];
}

export function ClientsGrid({ clients }: ClientsGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  );
}
