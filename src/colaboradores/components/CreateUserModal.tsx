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
}: {
  onUserCreated: () => void;
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
    <Dialog open={isOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setIsOpen(true)}>
          <Plus size={20} />
          <span>Crear usuario</span>
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
        </DialogHeader>
        <CreateUserForm onUserCreated={handleUserCreated} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

