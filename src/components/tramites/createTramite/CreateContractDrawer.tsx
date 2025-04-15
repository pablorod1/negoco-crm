"use client";

import { PlusIcon } from "lucide-react";
import { ContractDB } from "@/lib/core/types";
import React from "react";

import ContractForm from "./forms/ContractForm";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

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
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsOpen(true);
  };

  const handleAddContract = (contract: ContractDB) => {
    onCreateContract(contract);
    onClose();
  };

  const onClose = () => {
    if (onCloseProp) {
      onCloseProp();
    } else {
      setIsOpen(false);
    }
  };

  return (
    <>
      <Drawer
        open={isOpenProp ? isOpenProp : isOpen}
        dismissible={false}
        onOpenChange={onClose}
        shouldScaleBackground={false}
        z-index={1000}
      >
        <DrawerTrigger asChild>
          {!isOpenProp && !onCloseProp && (
            <Button variant="outline" onClick={handleOpen}>
              <PlusIcon
                width={32}
                height={32}
                stroke="var(--primary-color-300)"
              />
              <span className="text-center font-semibold text-primary-300">
                Añadir contrato
              </span>
            </Button>
          )}
        </DrawerTrigger>
        <DrawerContent inert={!isOpen} aria-describedby={undefined}>
          <div className="mx-auto w-full max-w-[1200px]">
            <DrawerHeader className="px-0">
              <DrawerTitle className="text-xl font-semibold text-primary-800">
                Crear contrato
              </DrawerTitle>
            </DrawerHeader>
            <ContractForm
              onCreateContract={handleAddContract}
              tramite_id={tramite_id}
              onCancel={onClose}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
