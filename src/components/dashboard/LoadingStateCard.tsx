import { User } from "@/lib/core/types";
import SpinnerComponent from "../core/SpinnerComponent";

export default function LoadingStateCard({ userData }: { userData: User }) {
  return (
    <div className=" w-full h-72 flex justify-center items-center ">
      <SpinnerComponent userData={userData} />
    </div>
  );
}
