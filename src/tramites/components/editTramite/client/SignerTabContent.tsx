import { SignerInfoBlock } from "@/clientes/components/SignerInfoBlock";
import type { SignerDB } from "@/tramites/types";

interface Props {
  clientId: string;
  signer: SignerDB | null;
  onSignerUpdated: () => void;
  isEditable: boolean | null;
}

export default function SignerTabContent({
  clientId,
  signer,
  onSignerUpdated,
  isEditable,
}: Props) {
  return (
    <div className="space-y-6">
      <SignerInfoBlock
        clientId={clientId}
        signer={signer}
        canEdit={!!isEditable}
        onUpdated={onSignerUpdated}
      />
    </div>
  );
}
