import TramiteFilesList from "@/tramites/components/editTramite/files/TramiteFilesList";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
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
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <div className="h-2 w-2 bg-gray-600 rounded-full"></div>
          Archivos Adjuntos
        </CardTitle>
        {files && (
          <CardDescription className="text-sm text-gray-500 mt-1">
            {files.length} archivo{files.length !== 1 ? "s" : ""} adjunto
            {files.length !== 1 ? "s" : ""}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {files && files.length > 0 ? (
          <TramiteFilesList
            files={files}
            tramite_id={tramite.id}
            organization_id={userData?.organization.id as string}
            onDeleted={onUpload}
            isEditable={isEditable as boolean}
          />
        ) : (
          <div className="flex items-center justify-center h-16 text-gray-400 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm">No hay archivos adjuntos</p>
          </div>
        )}
      </CardContent>
      {isEditable && (
        <CardFooter className="pt-4 border-t border-gray-200">
          <UploadTramiteFilesModal
            onUpload={onUpload}
            tramite_id={tramite.id}
            organization_id={userData?.organization.id as string}
            user_id={tramite.user_id as string}
            userData={userData}
            client={client}
          />
        </CardFooter>
      )}
    </Card>
  );
}
