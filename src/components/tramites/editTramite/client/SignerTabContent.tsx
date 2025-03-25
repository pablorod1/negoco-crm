import { SignerDB } from "@/lib/core/types";
import { Button } from "@heroui/button";
import { useDisclosure } from "@heroui/modal";
import { BriefcaseBusiness, IdCard, Mail, Phone, UserPen } from "lucide-react";
import EditSignerDrawer from "./EditSignerDrawer";

interface Props {
  signer: SignerDB;
  onSignerUpdated: () => void;
  isEditable: boolean | null;
}

export default function SignerTabContent({
  signer,
  onSignerUpdated,
  isEditable,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();
  return (
    <>
      <div className="space-y-12">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-primary-400">
              Nombre Completo
            </p>
            <p className="font-medium">
              {signer.name} {signer.last_name}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary-400" />
              <p className="font-medium">{signer.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-primary-400" />
              <p className="font-medium">{signer.phone}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IdCard className="size-4 text-primary-400" />
              <p className="font-medium">{signer.document_number}</p>
            </div>
            {signer.cargo && (
              <div className="flex items-center gap-2">
                <BriefcaseBusiness className="size-4 text-primary-400" />
                <p className="font-medium">{signer.cargo}</p>
              </div>
            )}
          </div>
        </div>
        {isEditable && (
          <Button
            variant="bordered"
            color="primary"
            radius="sm"
            onPress={onOpen}
            startContent={<UserPen size={16} />}
          >
            Editar Firmante
          </Button>
        )}
      </div>
      <EditSignerDrawer
        signer={signer}
        isOpen={isOpen}
        onClose={onClose}
        onSignerUpdated={onSignerUpdated}
      />
    </>
  );
}
