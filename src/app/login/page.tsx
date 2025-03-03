import Image from "next/image";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <Image
        src="/logo.webp"
        alt="Negoco CRM"
        width={250}
        height={250}
        className="absolute top-8 left-8 w-auto h-auto aspect-auto"
      />
      <LoginForm />
    </div>
  );
}
