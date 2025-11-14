"use client";

import { useEffect, useState, useMemo } from "react";
import { TramiteFile } from "@/tramites/types/tramite.types";
import LoadingStateCard from "@/dashboard/components/LoadingStateCard";
import { ClientFileCard } from "./ClientFileCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { FileX, Search } from "lucide-react";
import { Input } from "@/core/components/ui/input";

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
    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
    <Input
      type="search"
      placeholder="Buscar archivos..."
      className="w-full pl-9 pr-4 py-2 text-sm border-gray-200 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 rounded-lg"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

// Empty state component
const EmptyFilesState = ({ isFiltered }: { isFiltered: boolean }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 mb-4">
      <FileX className="h-8 w-8 text-gray-400" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      No hay archivos disponibles
    </h3>
    <p className="text-sm text-gray-500 max-w-sm">
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
        const res = await fetch(`/api/v2/clients/${client_id}/documents`, {
          method: "GET",
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center w-full h-32">
            <LoadingStateCard />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Archivos del Cliente
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Documentos y archivos asociados al cliente
              {filteredFiles.length > 0 && (
                <span className="font-medium text-gray-700 ml-1">
                  • {filteredFiles.length} archivos
                </span>
              )}
            </CardDescription>
          </div>
          <div className="w-full sm:w-auto">
            <FilesSearch value={filterValue} onChange={setFilterValue} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {filteredFiles.length > 0 ? (
          <div className="grid gap-4 ">
            {filteredFiles.map((file) => (
              <ClientFileCard file={file} key={file.id} />
            ))}
          </div>
        ) : (
          <EmptyFilesState isFiltered={filterValue.trim().length > 0} />
        )}
      </CardContent>
    </Card>
  );
}
