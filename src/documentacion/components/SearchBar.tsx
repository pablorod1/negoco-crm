"use client";
import { useState, useRef } from "react";
import { Search, X, Clock, FileText } from "lucide-react";
import { DocumentacionFile } from "@/core/types";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import LoaderComponent from "@/core/components/LoaderComponent";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface SearchBarProps {
  recentlyFiles?: DocumentacionFile[];
}

export default function SearchBar({ recentlyFiles }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<DocumentacionFile[]>([]);
  const [filterValue, setFilterValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onOpen = () => {
    setIsOpen(true);
    // Focus input after dialog opens
    setTimeout(() => inputRef.current?.focus(), 100);
  };

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
      const response = await fetch(`/api/v2/document-library/search`, {
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
    debouncedSearch(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          onClick={onOpen}
          size="icon"
          className="h-8 w-8 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Search className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl w-full p-0 border-0 bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden"
        onEscapeKeyDown={onClose}
        onInteractOutside={onClose}
      >
        <VisuallyHidden asChild>
          <DialogTitle>Buscar en Documentación</DialogTitle>
        </VisuallyHidden>
        {/* Spotlight Header */}
        <div className="relative border-b border-gray-100">
          <div className="flex items-center px-6 py-4">
            <Search className="h-5 w-5 text-gray-400 mr-4 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar documentos..."
              value={filterValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="flex-1 text-lg bg-transparent border-0 outline-none placeholder-gray-400 text-gray-900"
            />
            {filterValue && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setFilterValue("");
                  setFiles([]);
                  inputRef.current?.focus();
                }}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Spotlight Results */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center space-y-3">
                <LoaderComponent />
                <p className="text-sm text-gray-500">Buscando...</p>
              </div>
            </div>
          ) : !filterValue.trim() ? (
            // Recent Files - Spotlight Style
            recentlyFiles && recentlyFiles.length > 0 ? (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-700">
                    Recientes
                  </h3>
                </div>
                <div className="space-y-1">
                  {recentlyFiles.slice(0, 5).map((file, index) => (
                    <div
                      key={`recent-${file.id}-${index}`}
                      className="group flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {file.folder_name || "Raíz"}
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <kbd className="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded border">
                          ⏎
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Busca en tu documentación
                </h3>
                <p className="text-gray-500 text-center max-w-sm">
                  Encuentra rápidamente cualquier documento escribiendo su
                  nombre
                </p>
              </div>
            )
          ) : files.length > 0 ? (
            // Search Results - Spotlight Style
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Search className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-700">
                  {files.length} resultado{files.length > 1 ? "s" : ""}
                </h3>
              </div>
              <div className="space-y-1">
                {files.map((file, index) => (
                  <div
                    key={`search-${file.id}-${index}`}
                    className="group flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {file.folder_name || "Raíz"}
                      </p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <kbd className="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded border">
                        ⏎
                      </kbd>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // No Results - Spotlight Style
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Sin resultados
              </h3>
              <p className="text-gray-500 text-center max-w-sm">
                No se encontraron documentos que coincidan con &quot;
                {filterValue}&quot;
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Intenta con otros términos de búsqueda
              </p>
            </div>
          )}
        </div>

        {/* Footer - Spotlight Style */}
        <div className="border-t border-gray-100 px-6 py-3 bg-gray-50/50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-1 bg-white rounded border text-gray-600">
                  ⏎
                </kbd>
                <span>abrir</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-1 bg-white rounded border text-gray-600">
                  esc
                </kbd>
                <span>cerrar</span>
              </div>
            </div>
            <span>
              Documentación • {files.length + (recentlyFiles?.length || 0)}{" "}
              elementos
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
