"use client";
import { useUser } from "@/lib/contexts/UserContext";
import { ComparativaStatus, ComparativaVM, User } from "@/lib/core/types";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import {
  Calendar,
  ClipboardList,
  CloudAlert,
  Download,
  FileIcon,
  Flame,
  Lightbulb,
  LucideUser,
  Tag,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AvatarComponent from "@/components/core/AvatarComponent";
import { Divider } from "@heroui/divider";
import { formatDateTime } from "@/lib/core/format";
import Image from "next/image";
import { Chip } from "@heroui/chip";
import { downloadFile } from "@/lib/firebase/data/downloadFile";
import { showCustomToast } from "@/components/core/CustomToast";
import CreateNoteDialog from "@/components/tramites/editTramite/CreateNoteDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const postItColors = [
  "bg-yellow-200",
  "bg-green-200",
  "bg-blue-200",
  "bg-pink-200",
  "bg-purple-200",
];

export default function EditComparativaPage() {
  const { userData } = useUser();
  const params = useParams();
  const id = params.id;
  const [comparativa, setComparativa] = useState<ComparativaVM>();
  const [loading, setLoading] = useState(true);
  const [newNotes, setNewNotes] = useState<boolean>(false);

  const isAdmin = userData && userData.role === "admin";
  const isBackOffice = userData && userData.role === "1";

  const handleAddNewNote = async (note: string) => {
    setComparativa((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notes: [...prev.notes, note],
      };
    });
    setNewNotes(true);
  };

  useEffect(() => {
    const fetchComparativa = async () => {
      try {
        const rs = await fetch(`/api/comparativas/get/${id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userData?.id,
            user_role: userData?.role,
          }),
        });

        const { success, error, data } = await rs.json();

        if (!success) {
          throw new Error(error);
        }

        setComparativa(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchComparativa();
  }, [id, userData]);

  const getStatusBadge = (status: ComparativaStatus) => {
    switch (status) {
      case "pending":
        return (
          <Chip variant="flat" color="warning">
            Pendiente de Estudio
          </Chip>
        );
      case "completed":
        return (
          <Chip variant="flat" color="success">
            Estudio Realizado
          </Chip>
        );

      case "processed":
        return (
          <Chip variant="flat" color="primary">
            Comparativa Tramitada
          </Chip>
        );
      default:
        return <Chip variant="flat">Desconocido</Chip>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  const getServiceIcon = (service: "Luz" | "Gas") => {
    return service === "Luz" ? (
      <Lightbulb className="h-5 w-5 text-yellow-500" />
    ) : (
      <Flame className="h-5 w-5 text-orange-500" />
    );
  };

  const handleDownloadFile = async (filename: string) => {
    try {
      const { success, errors } = await downloadFile(
        `comparativas/${comparativa?.id}`,
        filename,
        userData?.organization.id as string
      );

      if (!success) {
        console.error(errors);
        showCustomToast({
          title: "Error al descargar el archivo",
          message: errors,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CloudAlert,
        });
        return;
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner
          label="Cargando..."
          color="primary"
          size="lg"
          className="text-xl"
        />
      </div>
    );
  }

  if (!comparativa) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Comparativa no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mx-12 py-6 ">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Detalles de Comparativa
          </h1>
          <p className="text-muted-foreground">ID: {comparativa.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(comparativa.status)}
          <Button variant="bordered">Editar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{comparativa.client}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <div className="flex items-center gap-1">
                    {getServiceIcon(comparativa.service)}
                    <span>Servicio: {comparativa.service}</span>
                  </div>
                  {comparativa.tramite_id && (
                    <div className="flex items-center gap-1 ml-4">
                      <ClipboardList className="h-4 w-4" />
                      <span>Trámite: {comparativa.tramite_id}</span>
                    </div>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="notes">
              <TabsList
                className={`grid mb-4 ${
                  isAdmin || isBackOffice ? "grid-cols-2" : ""
                }`}
              >
                <TabsTrigger value="notes">Notas</TabsTrigger>
                {(isAdmin || isBackOffice) && (
                  <TabsTrigger value="commissions">Comisiones</TabsTrigger>
                )}
              </TabsList>

              {(isAdmin || isBackOffice) && (
                <TabsContent value="commissions" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Comisión {userData.organization.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {comparativa.plan.includes("fijo") && (
                            <div className="flex justify-between">
                              <span>Precio Fijo:</span>
                              <span className="font-medium">
                                {comparativa.comision.fijo.toFixed(2)} €
                              </span>
                            </div>
                          )}
                          {comparativa.plan.includes("indexado") && (
                            <div className="flex justify-between">
                              <span>Precio Indexado:</span>
                              <span className="font-medium">
                                {comparativa.comision.indexado.toFixed(2)} €
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Comisión {comparativa.user.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {comparativa.plan.includes("fijo") && (
                            <div className="flex justify-between">
                              <span>Precio Fijo:</span>
                              <span className="font-medium">
                                {comparativa.comision_sales_person.fijo.toFixed(
                                  2
                                )}{" "}
                                €
                              </span>
                            </div>
                          )}
                          {comparativa.plan.includes("indexado") && (
                            <div className="flex justify-between">
                              <span>Precio Indexado:</span>
                              <span className="font-medium">
                                {comparativa.comision_sales_person.indexado.toFixed(
                                  2
                                )}{" "}
                                €
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="notes">
                <div className="space-y-4">
                  {comparativa.notes.length > 0 ? (
                    <ScrollArea className="w-full h-36 ">
                      <ul className="space-y-2 mx-4 py-4">
                        {comparativa.notes.map((note, index) => (
                          <li
                            key={index}
                            className={`${
                              postItColors[index % postItColors.length]
                            } p-4 rounded-lg shadow-md transform w-full  rotate-${
                              Math.floor(Math.random() * 5) - 2
                            } hover:rotate-0 transition-transform duration-200 ease-in-out`}
                          >
                            {note}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  ) : (
                    <p className="text-muted-foreground">
                      No hay notas disponibles.
                    </p>
                  )}
                  <CreateNoteDialog onCreateNote={handleAddNewNote} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* User and Date Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información Adicional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Info */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <LucideUser className="h-4 w-4" />
                <span>Creado por</span>
              </h3>

              <div className="flex items-center gap-3">
                <AvatarComponent
                  userData={comparativa.user as User}
                  className="!rounded-full"
                />
                <div>
                  <p className="font-medium">{comparativa.user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {comparativa.user.email}
                  </p>
                </div>
              </div>
            </div>

            <Divider />

            {/* Date Info */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Fecha de Creación</span>
              </h3>
              <p>{formatDateTime(comparativa.creation_date)}</p>
            </div>

            <Divider />

            {/* Status Info */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span>Estado</span>
              </h3>
              <div>{getStatusBadge(comparativa.status)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Archivos Adjuntos</CardTitle>
          <CardDescription>
            {comparativa.files.length} archivo
            {comparativa.files.length !== 1 ? "s" : ""} adjunto
            {comparativa.files.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comparativa.files.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comparativa.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-muted p-2 rounded">
                      {file.preview_url ? (
                        <Image
                          src={file.preview_url}
                          alt={file.filename as string}
                          width={50}
                          height={50}
                        />
                      ) : (
                        <FileIcon className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{file.filename}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{file.extension?.toUpperCase()}</span>
                        <span>•</span>
                        <span>
                          {file.size
                            ? formatFileSize(file.size)
                            : "Desconocido"}
                        </span>
                        <span>•</span>
                        <span>
                          {file.upload_date
                            ? formatDateTime(file.upload_date)
                            : "Fecha desconocida"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {file.download_url && (
                      <Button
                        variant="bordered"
                        isIconOnly
                        onPress={() =>
                          handleDownloadFile(file.filename as string)
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No hay archivos adjuntos.</p>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="bordered">Añadir Archivo</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
