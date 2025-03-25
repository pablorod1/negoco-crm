import { ClientDB } from "@/lib/core/types";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@heroui/drawer";
import EditClientForm from "./forms/EditClientForm";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  client: ClientDB;
  onClientUpdated: () => void;
}

export default function EditClientDrawer({
  isOpen,
  onClose,
  client,
  onClientUpdated,
}: Props) {
  const handleClientUpdated = () => {
    onClientUpdated();
    onClose();
  };
  return (
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
                {client.id}
              </h2>
            </DrawerHeader>
            <DrawerBody>
              <EditClientForm
                client={client}
                onCancel={onClose}
                onClientUpdated={handleClientUpdated}
              />
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
