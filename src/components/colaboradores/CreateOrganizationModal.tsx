"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Plus, UserRoundCheck, UserRoundX } from "lucide-react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/react";
import { authClient } from "@/lib/auth/auth-client";
import { showCustomToast } from "../core/CustomToast";
import { useState } from "react";
import DocumentsForm from "../tramites/DocumentsForm";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";

export default function CreateOrganizationModal() {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    image: "",
  });
  const [logo, setLogo] = useState<File[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      if (logo.length > 0 && logo.length > 1) {
        showCustomToast({
          title: "Error al crear organización",
          message: "Solo se permite un archivo para el logo",
          icon: UserRoundX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      const res = await authClient.organization.create({
        name: formData.name,
        slug: formData.slug,
      });

      if (res.error) {
        showCustomToast({
          title: "Error al crear organización",
          message: res.error.message,
          icon: UserRoundX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
      }

      showCustomToast({
        title: "Organización creada",
        message: "La organización ha sido creada correctamente",
        icon: UserRoundCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      if (res.data && logo.length === 1) {
        const newOrgId = res.data.id;

        const { downloadURL } = await uploadFile(logo[0], newOrgId, "logo");

        const updateRes = await authClient.organization.update({
          organizationId: newOrgId,
          data: { logo: downloadURL },
        });

        if (updateRes.error) {
          showCustomToast({
            title: "Error al subir logo",
            message: updateRes.error.message,
            icon: UserRoundX,
            iconColor: "var(--danger-color)",
            iconSize: 24,
          });
          return;
        }

        showCustomToast({
          title: "Logo subido",
          message: "El logo ha sido subido correctamente",
          icon: UserRoundCheck,
          iconColor: "var(--success-color)",
          iconSize: 24,
        });
      }
      onClose();
    } catch (error) {
      showCustomToast({
        title: "Error al crear organización",
        message: error + " Inténtalo de nuevo más tarde",
        icon: UserRoundX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button color="primary" onPress={onOpen}>
        <Plus size={20} />
        <span>Crear Organización</span>
      </Button>

      <Modal inert={!isOpen} isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Crear organización</ModalHeader>
          <ModalBody>
            <form className="space-y-6 w-full py-2">
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                isRequired
                label="Nombre"
                placeholder="Ingrese el nombre"
                className="w-full"
                color="primary"
                variant="bordered"
                radius="sm"
              />

              <Input
                id="slug"
                name="slug"
                type="text"
                value={formData.slug}
                onChange={handleChange}
                isRequired
                label="Slug"
                className="w-full"
                color="primary"
                variant="bordered"
                radius="sm"
              />

              <DocumentsForm uploadedFiles={logo} setUploadedFiles={setLogo} />
              <Button
                onPress={handleSubmit}
                className="w-full"
                disabled={isLoading}
                color="primary"
              >
                {isLoading ? "Creando organización..." : "Crear Organización"}
              </Button>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
