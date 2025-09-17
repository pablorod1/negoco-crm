"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Plus } from "lucide-react";
import CreateUserForm from "./CreateUserForm";
import { Button } from "@/core/components/ui/button";
import { useState } from "react";

export default function CreateUserModal({
  onUserCreated,
  disabled = false,
}: {
  onUserCreated: () => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const onClose = () => {
    setIsOpen(false);
  };

  const handleUserCreated = () => {
    onUserCreated();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-primary-900 hover:bg-primary-800 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={disabled}
        >
          <Plus size={16} />
          <span>Nuevo usuario</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md border-gray-200"
      >
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Crear usuario
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Completa la información para crear un nuevo colaborador
          </p>
        </DialogHeader>
        <CreateUserForm onUserCreated={handleUserCreated} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
