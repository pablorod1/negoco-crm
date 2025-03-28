import { User } from "@/lib/core/types";
import { Spinner } from "@heroui/spinner";
import Image from "next/image";

export default function SpinnerComponent({ userData }: { userData: User }) {
  return (
    <Spinner variant="gradient" color="primary" size="lg" className="relative">
      {userData && (
        <Image
          src={
            (userData.organization.logo as string) || "/logo_sin_letras.webp"
          }
          alt="Logo"
          width={32}
          height={32}
          className="absolute -top-2 left-0 right-0 bottom-0 m-auto aspect-square w-auto h-auto"
        />
      )}
    </Spinner>
  );
}
