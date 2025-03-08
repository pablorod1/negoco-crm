import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { DocumentacionFile, User } from "@/lib/core/types";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { FileCard } from "./FileCard";
import { useUser } from "@/lib/contexts/UserContext";

interface SearchBarProps {
  recentlyFiles?: DocumentacionFile[];
}

export default function SearchBar({ recentlyFiles }: SearchBarProps) {
  const { userData } = useUser();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [files, setFiles] = useState<DocumentacionFile[]>([]);
  const [filterValue, setFilterValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    onClose();
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

      if (success) {
        setFiles(data as DocumentacionFile[]);
      } else {
        console.error("Error fetching files:", data);
        setFiles([]);
      }
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

  // Handle escape key
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [onClose]);

  return (
    <>
      <Button
        variant="flat"
        size="sm"
        className="bg-transparent"
        onPress={onOpen}
        isIconOnly
      >
        <Search className="h-4 w-4" />
      </Button>

      <Modal
        placement="top"
        hideCloseButton
        size="5xl"
        radius="sm"
        isOpen={isOpen}
        onClose={handleClose}
      >
        <ModalContent>
          <ModalHeader>
            <Input
              size="lg"
              type="text"
              radius="sm"
              placeholder="Buscar archivos..."
              value={filterValue}
              onChange={handleInputChange}
              className="w-full "
            />
          </ModalHeader>
          <ModalBody>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner
                  size="lg"
                  label="Cargando archivos..."
                  color="primary"
                  className="text-xl"
                />
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {files.length > 0 ? (
                  <>
                    <h2 className="text-lg font-semibold text-[var(--primary-color-800)]">
                      {files.length}{" "}
                      {files.length === 1 ? "archivo " : "archivos "}
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
                    <h2 className="text-xl font-semibold text-[var(--primary-color-800)]">
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
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
