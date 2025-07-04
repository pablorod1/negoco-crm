import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { LucideIcon } from "lucide-react";

interface ClientDetailCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function ClientDetailCard({
  title,
  icon: Icon,
  children,
  className = "",
  contentClassName = "pt-6 p-6",
}: ClientDetailCardProps) {
  return (
    <Card
      className={`shadow-sm hover:shadow transition-shadow duration-300 overflow-hidden border-0 ${className}`}
    >
      <CardHeader className="border-b bg-gradient-to-br from-primary-400 via-primary-600 to-primary-800">
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

