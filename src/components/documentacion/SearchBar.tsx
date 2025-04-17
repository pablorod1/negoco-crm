"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { DocumentacionFile, User } from "@/lib/core/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileCard } from "./FileCard";
import { useUser } from "@/lib/contexts/UserContext";
import SpinnerComponent from "../core/FullScreenLoaderComponent";
import { InputComponent } from "../tramites/createTramite/InputComponent";
import LoaderComponent from "../core/LoaderComponent";

interface SearchBarProps {
  recentlyFiles?: DocumentacionFile[];
}

export default function SearchBar({ recentlyFiles }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { userData } = useUser();
  const [files, setFiles] = useState<DocumentacionFile[]>([]);
  const [filterValue, setFilterValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onOpen = () => setIsOpen(true);

  const onClose = () => {
    setIsOpen(false);
    setFilterValue("");
    setFiles([]);
  };

  // Debounced search function
  let timeoutId: NodeJS.Timeout;
  const debouncedSearch = (value: string) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (value.trim()) {
        fetchFiles(value);
      } else {
        setFiles([]);
        setIsLoading(false);
      }
    }, 300);
  };

  const fetchFiles = async (searchTerm: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/documentacion/get/files-by-name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: searchTerm }),
      });
      const { data, success } = await response.json();

      if (!success) {
        console.error("Error fetching files:", data);
        setFiles([]);
        return;
      }

      setFiles(data as DocumentacionFile[]);
    } catch (error) {
      console.error("Error fetching files:", error);
      setFiles([]);
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilterValue(value);
    setIsLoading(true);
    debouncedSearch(value); // trigger the debounced search
  };

  return (
    <Dialog open={isOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" onClick={onOpen} size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl w-full"
        onEscapeKeyDown={onClose}
        onInteractOutside={onClose}
      >
        <DialogHeader>
          <DialogTitle className="text-xl text-primary-800">
            Buscar archivos
          </DialogTitle>
          <InputComponent
            type="text"
            name="search"
            placeholder="Buscar archivos..."
            value={filterValue}
            onChange={handleInputChange}
          />
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <LoaderComponent
              title="Buscando archivos..."
              description="Espere unos segundos mientras buscamos si existe algún archivo con ese nombre."
            />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {files.length > 0 ? (
              <>
                <h2 className="text-lg font-semibold text-primary-800">
                  {files.length} {files.length === 1 ? "archivo " : "archivos "}
                  encontrados
                </h2>
                {files.map((file) => (
                  <FileCard
                    userData={userData as User}
                    view="list"
                    key={file.id}
                    file={file}
                  />
                ))}
              </>
            ) : filterValue ? (
              <p>No se encontraron resultados</p>
            ) : (
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-primary-800">
                  Archivos recientes
                </h2>
                {recentlyFiles?.map((file) => (
                  <FileCard
                    userData={userData as User}
                    view="list"
                    key={file.id}
                    file={file}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
