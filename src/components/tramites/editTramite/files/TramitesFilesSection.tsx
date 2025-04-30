import TramiteFilesList from "@/components/tramites/editTramite/files/TramiteFilesList";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileIcon } from "lucide-react";
import { ClientDB, TramiteDB, TramiteFile, User } from "@/lib/core/types";
import UploadTramiteFilesModal from "./UploadTramiteFilesModal";

interface Props {
  files: TramiteFile[];
  userData: User;
  tramite: TramiteDB;
  onUpload: () => void;
  isEditable: boolean | null;
  isTramitableBorrador: boolean;
  client: ClientDB;
}

export default function TramiteFilesSection({
  files,
  userData,
  tramite,
  onUpload,
  isEditable,
  isTramitableBorrador,
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
            isTramitableBorrador={isTramitableBorrador}
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
