import TramiteFilesList from "@/tramites/components/editTramite/files/TramiteFilesList";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { FileIcon } from "lucide-react";
import { User } from "@/core/types";
import UploadTramiteFilesModal from "./UploadTramiteFilesModal";
import { TramiteFile, TramiteDB, ClientDB } from "@/tramites/types";

interface Props {
  files: TramiteFile[];
  userData: User;
  tramite: TramiteDB;
  onUpload: () => void;
  isEditable: boolean | null;
  client: ClientDB;
}

export default function TramiteFilesSection({
  files,
  userData,
  tramite,
  onUpload,
  isEditable,
  client,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary-800">
          <FileIcon className="h-5 w-5" />
          Archivos Adjuntos
        </CardTitle>
        {files && (
          <CardDescription className="text-primary-400">
            {files.length} archivo{files.length !== 1 ? "s" : ""} adjunto
            {files.length !== 1 ? "s" : ""}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {files && files.length > 0 ? (
          <TramiteFilesList
            files={files}
            tramite_id={tramite.id}
            organization_id={userData?.organization.id as string}
            onDeleted={onUpload}
            isEditable={isEditable as boolean}
          />
        ) : (
          <p className="text-muted-foreground">No hay archivos adjuntos.</p>
        )}
      </CardContent>
      <CardFooter>
        {isEditable && (
          <UploadTramiteFilesModal
            onUpload={onUpload}
            tramite_id={tramite.id}
            organization_id={userData?.organization.id as string}
            user_id={tramite.user_id as string}
            userData={userData}
            client={client}
          />
        )}
      </CardFooter>
    </Card>
  );
}
