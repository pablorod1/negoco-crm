import { User } from "@/lib/core/types";
import SpinnerComponent from "./SpinnerComponent";

export default function LoadingStateModal({ userData }: { userData: User }) {
  return (
    <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-85 z-50">
      <SpinnerComponent userData={userData} />
    </div>
  );
}
