"use client";
import { ClientDB, ContractDB, SignerDB } from "@/lib/core/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import EditClientForm from "./forms/EditClientForm";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Info, UserPen } from "lucide-react";
import EditSignerForm from "./forms/EditSignerForm";
import ContractForm from "../../createTramite/forms/ContractForm";
import EditContractForm from "../contract/EditContractForm";

interface Props {
  client?: ClientDB;
  signer?: SignerDB;
  contract?: ContractDB;
  newContract?: boolean;
  onUpdate?: () => void;
  onContract?: (contract: ContractDB) => void;
  tramite_id?: string;
  loading?: boolean;
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
              ? "Datos del cliente" + client.id
              : signer
                ? "Datos del Firmante" + signer.id
                : newContract
                  ? "Nuevo Contrato"
                  : contract
                    ? "Datos del contrato" + contract.id
                    : null}
          </SheetTitle>
          {(client || signer) && (
            <SheetDescription className="inline-flex items-start gap-2 border border-danger bg-danger-50 rounded-md p-4">
              <Info size={28} className="text-danger pb-2" />
              <span className="text-danger text-xs">
                {client
                  ? `Si este cliente tiene otros trámites asociados, se actualizarán
              automáticamente los datos de este cliente en todos los trámites
              asociados a él.`
                  : signer
                    ? `Este firmante está asociado a un cliente, por lo que si se
              actualizan los datos de este firmante, se actualizarán los datos
              de este firmante en todos los trámites asociados a él.`
                    : null}
              </span>
            </SheetDescription>
          )}
        </SheetHeader>
        {client ? (
          <EditClientForm
            client={client}
            onCancel={onClose}
            onClientUpdated={handleUpdate}
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
