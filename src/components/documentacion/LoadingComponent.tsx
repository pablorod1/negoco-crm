import SpinnerComponent from "../core/SpinnerComponent";
import { User } from "@/lib/core/types";

export default function LoadingComponent({ userData }: { userData: User }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <SpinnerComponent userData={userData} />
    </div>
  );
}
