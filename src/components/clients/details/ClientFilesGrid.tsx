"use client";

import { useEffect, useState, useMemo } from "react";
import { TramiteFile } from "@/lib/core/types";
import LoadingStateCard from "@/components/dashboard/LoadingStateCard";
import { ClientFileCard } from "./ClientFileCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileX, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  client_id: string;
}

// Files search component
const FilesSearch = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="relative">
    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      type="search"
      placeholder="Buscar archivos..."
      className="w-full pl-8 md:w-[300px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

// Empty state component
const EmptyFilesState = ({ isFiltered }: { isFiltered: boolean }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <FileX className="h-12 w-12 text-muted-foreground mb-3" />
    <h3 className="text-lg font-semibold">No hay archivos disponibles</h3>
    <p className="text-muted-foreground mt-1">
      {isFiltered
        ? "No se encontraron archivos que coincidan con tu búsqueda"
        : "Aún no se han subido archivos para este cliente"}
    </p>
  </div>
);

export function ClientFilesGrid({ client_id }: Props) {
  const [files, setFiles] = useState<TramiteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState("");

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch(`/api/clients/get/${client_id}/tramite-files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const { success, data, error } = await res.json();

        if (!success) {
          console.error("Error al obtener archivos:", error);
          setFiles([]);
          return;
        }

        if (data) {
          setFiles(data);
        } else {
          setFiles([]);
        }
      } catch (error) {
        console.error("Error fetching files:", error);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [client_id]);

  // Optimize filtering with useMemo
  const filteredFiles = useMemo(() => {
    if (!filterValue.trim()) return files;

    // Split search into terms for better matching
    const searchTerms = filterValue
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    return files.filter((file) => {
      const filename = file.filename.toLowerCase();
      // Match if all search terms are found in the filename
      return searchTerms.every((term) => filename.includes(term));
    });
  }, [files, filterValue]);

  if (loading) {
    return (
      <div className="flex justify-center items-center w-full h-44">
        <LoadingStateCard />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div>
          <CardTitle>Archivos Subidos</CardTitle>
          <CardDescription>
            Documentos subidos por los comerciales.
          </CardDescription>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <FilesSearch value={filterValue} onChange={setFilterValue} />
        </div>
      </CardHeader>
      <CardContent>
        {filteredFiles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {filteredFiles.map((file) => (
              <ClientFileCard file={file} view="grid" key={file.id} />
            ))}
          </div>
        ) : (
          <EmptyFilesState isFiltered={filterValue.trim().length > 0} />
        )}
      </CardContent>
    </Card>
  );
}
