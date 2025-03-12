import LoginWrapper from "@/components/auth/login/LoginWrapper";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Negoco CRM | Acceso",
  description: "Accede a tu panel de consultoría energética Negoco CRM",
};

export default function LoginPage() {
  return <LoginWrapper />;
}
