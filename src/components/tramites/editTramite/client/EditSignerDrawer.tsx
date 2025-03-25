import { SignerDB } from "@/lib/core/types";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@heroui/drawer";
import EditSignerForm from "./forms/EditSignerForm";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  signer: SignerDB;
  onSignerUpdated: () => void;
}

export default function EditSignerDrawer({
  isOpen,
  onClose,
  signer,
  onSignerUpdated,
}: Props) {
  const handleSignerUpdated = () => {
    onSignerUpdated();
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
                {signer.id}
              </h2>
            </DrawerHeader>
            <DrawerBody>
              <EditSignerForm
                signer={signer}
                onCancel={onClose}
                onSignerUpdated={handleSignerUpdated}
              />
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
