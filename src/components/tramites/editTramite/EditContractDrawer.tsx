"use client";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  useDisclosure,
} from "@heroui/react";
import { Pencil } from "lucide-react";
import { ContractDB } from "@/lib/core/types";
import React from "react";

import EditContractForm from "./forms/EditContractForm";

interface Props {
  contract: ContractDB;
  onSavingContract: (contract: ContractDB) => void;
}

export default function EditContractDrawer({
  contract,
  onSavingContract,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onOpen();
  };

  const handleUpdateContract = (contract: ContractDB) => {
    onSavingContract(contract);
    onClose();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="opacity-0 cursor-pointer absolute top-0 left-0 right-0 flex justify-center items-center gap-4 h-full bg-black/20 rounded-sm group-hover:opacity-100 transition-opacity duration-300"
      >
        <Pencil size={20} className="text-white" />
        <p className="text-lg font-bold text-white">Editar Contrato</p>
      </button>
      <Drawer
        size="5xl"
        isDismissable={false}
        isOpen={isOpen}
        onClose={onClose}
        radius="sm"
        placement="bottom"
        classNames={{
          base: "max-w-[1200px] w-full !mx-auto",
        }}
      >
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader>
                <h2 className="text-xl font-semibold text-[var(--primary-color-800)]">
                  {contract.id}
                </h2>
              </DrawerHeader>
              <DrawerBody>
                <EditContractForm
                  onSavingContract={handleUpdateContract}
                  contract={contract}
                  onCancel={onClose}
                />
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
