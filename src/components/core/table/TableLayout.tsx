import { type ReactNode } from "react";

interface TableLayoutProps {
  children: ReactNode;
}

export function TableLayout({ children }: TableLayoutProps) {
  return <div className="w-full">{children}</div>;
}
