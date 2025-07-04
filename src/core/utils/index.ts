import { clsx, type ClassValue } from "clsx";
import toast from "react-hot-toast";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const copyLink = (value: string) => {
  navigator.clipboard.writeText(value);
  toast("Copiado al portapapeles", {
    icon: "📋",
    position: "top-center",
  });
};
