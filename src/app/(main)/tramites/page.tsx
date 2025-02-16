"use client";
import { columns } from "../../../components/tramites/table/columns";
import { DataTable } from "../../../components/tramites/table/Table";

export default function TramitesPage() {
  return (
    <section className="pb-12">
      <DataTable columns={columns} />
    </section>
  );
}
