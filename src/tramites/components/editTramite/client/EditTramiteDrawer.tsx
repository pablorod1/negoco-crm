"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/core/components/ui/sheet";
import EditClientForm from "./forms/EditClientForm";
import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { UserPen } from "lucide-react";
import EditSignerForm from "./forms/EditSignerForm";
import ContractForm from "../../createTramite/forms/ContractForm";
import EditContractForm from "../contract/EditContractForm";
import { ClientDB, ContractDB, SignerDB } from "@/tramites/types";
import { User } from "@/core/types";
import { formatUUID } from "@/core/utils/format";

interface Props {
  client?: ClientDB;
  signer?: SignerDB;
  contract?: ContractDB;
  newContract?: boolean;
  onUpdate?: () => void;
  onContract?: (contract: ContractDB) => void;
  tramite_id?: string;
  loading?: boolean;
  userData?: User;
}

export default function EditDrawer({
  client,
  onUpdate,
  signer,
  contract,
  newContract,
  onContract,
  tramite_id,
  loading,
  userData,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const onClose = () => setIsOpen(false);
  const onOpen = () => setIsOpen(true);
  const handleUpdate = () => {
    if (onUpdate) onUpdate();
    onClose();
  };

  const handleContract = (contract: ContractDB) => {
    if (onContract) onContract(contract);
    onClose();
  };
  return (
    <Sheet open={isOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" onClick={onOpen}>
          <UserPen size={16} />
          {!newContract
            ? `Editar ${client ? "Cliente" : signer ? "Firmante" : contract ? "Contrato" : ""} `
            : "Nuevo Contrato"}
        </Button>
      </SheetTrigger>
      <SheetContent
        aria-describedby={undefined}
        className={`${newContract || contract ? "w-[1200px] mx-auto rounded-t-md" : "w-[480px]"}`}
        side={newContract || contract ? "bottom" : "right"}
      >
        <SheetHeader className="mb-8">
          <SheetTitle className="text-xl font-semibold text-primary-800">
            {client
              ? "Datos del cliente " + formatUUID(client.id)
              : signer
                ? "Datos del Firmante " + formatUUID(signer.id)
                : newContract
                  ? "Nuevo Contrato"
                  : contract
                    ? "Datos del contrato " + formatUUID(contract.id)
                    : null}
          </SheetTitle>
        </SheetHeader>
        {client ? (
          <EditClientForm
            client={client}
            onCancel={onClose}
            onClientUpdated={handleUpdate}
            tramite_id={tramite_id as string}
            signer={signer}
            userData={userData as User}
          />
        ) : signer ? (
          <EditSignerForm
            signer={signer}
            onCancel={onClose}
            onSignerUpdated={handleUpdate}
          />
        ) : newContract && onContract && tramite_id ? (
          <ContractForm
            onCancel={onClose}
            onCreateContract={handleContract}
            tramite_id={tramite_id}
            lastStep
          />
        ) : contract && onContract ? (
          <EditContractForm
            contract={contract}
            onSavingContract={handleContract}
            onCancel={onClose}
            loading={loading}
            lastStep
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
