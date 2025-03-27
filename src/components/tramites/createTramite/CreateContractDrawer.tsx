"use client";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@heroui/drawer";
import { useDisclosure } from "@heroui/modal";
import { PlusIcon } from "lucide-react";
import { ContractDB } from "@/lib/core/types";
import React from "react";

import ContractForm from "./forms/ContractForm";

interface Props {
  tramite_id: string;
  onCreateContract: (contract: ContractDB) => void;
  isOpenProp?: boolean;
  onCloseProp?: () => void;
}

export default function CreateContractDrawer({
  tramite_id,
  onCreateContract,
  isOpenProp,
  onCloseProp,
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
      {!isOpenProp && !onCloseProp && (
        <button onClick={handleOpen}>
          <div className="w-56 h-72 flex flex-col justify-center items-center border-2 border-dashed border-primary-300 rounded-lg cursor-pointer hover:bg-primary-50 transition-colors">
            <PlusIcon
              width={32}
              height={32}
              stroke="var(--primary-color-300)"
            />
            <span className="text-center font-semibold text-primary-300">
              Añadir contrato
            </span>
          </div>
        </button>
      )}
      <Drawer
        size="5xl"
        radius="sm"
        isDismissable={false}
        isOpen={isOpenProp ? isOpenProp : isOpen}
        onClose={onClose}
        placement="bottom"
        classNames={{
          base: "max-w-[1200px] w-full !mx-auto",
        }}
      >
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader>
                <h2 className="text-xl font-semibold text-primary-800">
                  Crear contrato
                </h2>
              </DrawerHeader>
              <DrawerBody>
                <ContractForm
                  onCreateContract={handleAddContract}
                  tramite_id={tramite_id}
                  onCancel={onCloseProp ? onCloseProp : onClose}
                />
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
