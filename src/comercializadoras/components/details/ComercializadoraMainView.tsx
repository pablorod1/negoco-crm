import { ComercializadoraDetails } from "@/comercializadoras/types";
import { ComercializadoraMainCard } from "./ComercializadoraMainCard";

interface ComercializadoraMainViewProps {
  comercializadora: ComercializadoraDetails;
}

export function ComercializadoraMainView({
  comercializadora,
}: ComercializadoraMainViewProps) {
  return (
    <div className="space-y-6">
      <ComercializadoraMainCard comercializadora={comercializadora} />
    </div>
  );
}
