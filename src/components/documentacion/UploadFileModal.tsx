import { getAllFoldersWithPaths } from "@/lib/firebase/data/getFolders";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Folder, ChevronRight, UploadIcon, ChevronDown } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useDocumentacion } from "@/contexts/DocumentacionContext";
import { Spinner } from "@heroui/react";
import { useUser } from "@/contexts/UserContext";

interface FileWithPreview extends File {
  preview?: string;
}

interface FolderStructure {
  path: string;
  displayName: string;
  level: number;
  parent: string;
  subfolders: FolderStructure[];
}

interface FolderGroup {
  name: string;
  path: string;
  subfolders: FolderStructure[];
}

export default function UploadFileModal() {
  const { userData } = useUser();
  const { refreshDocumentacion } = useDocumentacion();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [folderGroups, setFolderGroups] = useState<FolderGroup[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("/");
  const [createFolder, setCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["/"])
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filesWithPreview = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setFiles((prev) => [...prev, ...filesWithPreview]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
  });

  useEffect(() => {
    const fetchAllFolders = async () => {
      const { success, data: folders } = await getAllFoldersWithPaths(
        userData?.organization.id as string
      );
      if (success && folders) {
        const folderMap: Record<string, FolderStructure> = {};
        const groups: Record<string, FolderGroup> = {
          root: { name: "Inicio", path: "", subfolders: [] },
        };

        // First pass: create all folder objects
        folders.forEach((path) => {
          const parts = path.split("/");
          const level = parts.length;
          const name = parts[parts.length - 1];
          const parent = parts.slice(0, -1).join("/");

          folderMap[path] = {
            path,
            displayName: name,
            level,
            parent,
            subfolders: [],
          };

          if (level === 1) {
            groups[path] = {
              name,
              path,
              subfolders: [],
            };
          }
        });

        // Second pass: build the hierarchy
        Object.values(folderMap).forEach((folder) => {
          if (folder.parent) {
            if (folder.level === 2) {
              // Level 2 folders go directly into their top-level group
              const topLevelParent = folder.path.split("/")[0];
              if (groups[topLevelParent]) {
                groups[topLevelParent].subfolders.push(folder);
              }
            } else {
              // Deeper level folders go into their immediate parent's subfolders
              const parentFolder = folderMap[folder.parent];
              if (parentFolder) {
                parentFolder.subfolders.push(folder);
              }
            }
          }
        });

        // Sort all subfolders recursively
        const sortFolders = (folders: FolderStructure[]) => {
          folders.sort((a, b) => a.displayName.localeCompare(b.displayName));
          folders.forEach((folder) => {
            if (folder.subfolders.length > 0) {
              sortFolders(folder.subfolders);
            }
          });
        };

        Object.values(groups).forEach((group) => {
          sortFolders(group.subfolders);
        });

        setFolderGroups(Object.values(groups));
      }
    };

    fetchAllFolders();
  }, [userData]);

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const getUploadFilePath = () => {
    if (selectedFolder === "/" && !createFolder) {
      return selectedFolder;
    } else if (selectedFolder === "/" && createFolder) {
      return newFolderName;
    } else if (selectedFolder !== "/" && !createFolder) {
      return selectedFolder;
    } else if (selectedFolder !== "/" && createFolder) {
      return `${selectedFolder}/${newFolderName}`;
    }

    return selectedFolder;
  };

  const handleUpload = async () => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("folder_name", getUploadFilePath());
      formData.append("organization_id", userData?.organization.id as string);
      const response = await fetch("/api/documentacion/add", {
        method: "POST",
        body: formData,
      });
      const { success, error } = await response.json();
      if (!success) {
        throw new Error(error);
      }
      setFiles([]);
      handleClose();
      refreshDocumentacion();
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setCreateFolder(false);
    setNewFolderName("");
    setSelectedFolder("/");
    onClose();
  };

  const toggleFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderSubfolders = (
    subfolders: FolderStructure[],
    padding: number = 36
  ) => {
    return subfolders.map((subfolder) => (
      <div key={subfolder.path}>
        <button
          onClick={() => setSelectedFolder(subfolder.path)}
          className={`w-full px-3 py-2 text-left flex items-center gap-2 rounded hover:bg-gray-100 ${
            selectedFolder === subfolder.path ? "bg-blue-50 text-blue-600" : ""
          }`}
          style={{ paddingLeft: `${padding}px` }}
        >
          <Folder size={16} />
          <span>{subfolder.displayName}</span>
          {subfolder.subfolders.length > 0 ? (
            <div
              onClick={(e) => toggleFolder(subfolder.path, e)}
              className="hover:bg-gray-200 rounded p-0.5"
            >
              {expandedFolders.has(subfolder.path) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </div>
          ) : (
            <div className="w-[28px]" /> // Spacer for alignment
          )}
        </button>
        {subfolder.subfolders.length > 0 && (
          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              expandedFolders.has(subfolder.path) ? "max-h-screen" : "max-h-0"
            }`}
          >
            {renderSubfolders(subfolder.subfolders, padding + 16)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <>
      <Button
        variant="ghost"
        color="primary"
        onPress={onOpen}
        radius="sm"
        className="w-full max-w-64"
        startContent={<UploadIcon width={16} height={16} />}
      >
        <span className="text-base font-bold">Subir archivos</span>
      </Button>
      <Modal isOpen={isOpen} onClose={handleClose} size="2xl">
        <ModalContent>
          {" "}
          <ModalHeader className="flex flex-col gap-1">
            Subir archivos
          </ModalHeader>
          <ModalBody>
            {isUploading && (
              <div className="h-full w-full absolute top-0 left-0 bg-white/60 flex justify-center items-center">
                <Spinner
                  label="Subiendo archivos..."
                  color="primary"
                  size="lg"
                  className="text-xl"
                />
              </div>
            )}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${
                      isDragActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
            >
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Suelta los archivos aquí...</p>
              ) : (
                <div>
                  <p>
                    Arrastra y suelta archivos aquí, o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Formatos soportados: PNG, JPG, PDF, DOC, DOCX
                  </p>
                </div>
              )}
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm truncate max-w-[200px]">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => removeFile(index)}
                    >
                      Eliminar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Carpeta destino</label>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedFolder("/")}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 rounded hover:bg-gray-100 ${
                      selectedFolder === "/" ? "bg-blue-50 text-blue-600" : ""
                    }`}
                  >
                    <Folder size={16} />
                    <span>Inicio</span>
                  </button>
                  {folderGroups.map(
                    (group) =>
                      group.path && (
                        <div key={group.path} className="space-y-1 ps-6">
                          <button
                            onClick={() => setSelectedFolder(group.path)}
                            className={`w-full px-3 py-2 text-left flex items-center gap-2 rounded hover:bg-gray-100 ${
                              selectedFolder === group.path
                                ? "bg-blue-50 text-blue-600"
                                : ""
                            }`}
                          >
                            <Folder size={16} />

                            <span>{group.name}</span>
                            <div
                              onClick={(e) => toggleFolder(group.path, e)}
                              className="hover:bg-gray-200 rounded p-0.5"
                            >
                              {group.subfolders.length > 0 &&
                                (expandedFolders.has(group.path) ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                ))}
                            </div>
                          </button>
                          {group.subfolders.length > 0 && (
                            <div
                              className={`overflow-hidden transition-all duration-200 ease-in-out ${
                                expandedFolders.has(group.path)
                                  ? "max-h-screen"
                                  : "max-h-0"
                              }`}
                            >
                              {renderSubfolders(group.subfolders)}
                            </div>
                          )}
                        </div>
                      )
                  )}
                  <button
                    onClick={() => setCreateFolder(true)}
                    className="w-full px-3 py-2 text-left text-blue-600 hover:bg-gray-100 rounded"
                  >
                    + Crear nueva carpeta
                  </button>
                </div>
              </div>

              {createFolder && (
                <Input
                  name="newFolder"
                  label="Nueva carpeta"
                  placeholder="Nombre de la carpeta"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={handleClose}>
              Cancelar
            </Button>
            <Button
              color="primary"
              onPress={handleUpload}
              isLoading={isUploading}
              isDisabled={files.length === 0}
            >
              Subir archivos
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
