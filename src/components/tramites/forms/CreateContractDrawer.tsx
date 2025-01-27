"use client";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  useDisclosure,
} from "@heroui/react";
import { PlusIcon } from "lucide-react";
import { ContractDB, TramiteDB } from "@/lib/types";
import React from "react";

import ContractForm from "./ContractForm";

interface Props {
  tramite: TramiteDB;
  onCreateContract: (contract: ContractDB) => void;
}

export default function CreateContractDrawer({
  tramite,
  onCreateContract,
}: Props) {
  const { isOpen, onClose, onOpen } = useDisclosure();

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onOpen();
  };

  const handleAddContract = (contract: ContractDB) => {
    onCreateContract(contract);
    onClose();
  };

  return (
    <>
      <button onClick={handleOpen}>
        <div className="w-56 h-72 flex flex-col justify-center items-center border-2 border-dashed border-[var(--primary-color-300)] rounded-lg cursor-pointer hover:bg-[var(--primary-color-50)] transition-colors">
          <PlusIcon width={32} height={32} stroke="var(--primary-color-300)" />
          <span className="text-center font-semibold text-[var(--primary-color-300)]">
            Añadir contrato
          </span>
        </div>
      </button>
      <Drawer
        hideCloseButton
        size="5xl"
        isOpen={isOpen}
        onClose={onClose}
        placement="bottom"
      >
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader>
                <h2 className="text-xl font-semibold text-gray-800">
                  Crear contrato
                </h2>
              </DrawerHeader>
              <DrawerBody>
                <ContractForm
                  onCreateContract={handleAddContract}
                  tramite_id={tramite.id}
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
