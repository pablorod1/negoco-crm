"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/core/components/ui/breadcrumb";
import { useTransitionRouter } from "next-view-transitions";
import { ComercializadoraDetails } from "@/comercializadoras/types";

export function ComercializadoraDetailsHeader({
  comercializadora,
}: {
  comercializadora: ComercializadoraDetails;
}) {
  const router = useTransitionRouter();

  const handleBack = () => {
    router.back();
  };

  const handleComercializadoras = () => {
    router.push("/comercializadoras");
  };

  return (
    <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border px-6 py-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="hover:bg-primary-50 hover:text-primary-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="h-6 w-px bg-gray-300" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={handleComercializadoras}
                className="cursor-pointer hover:text-primary-600 transition-colors"
              >
                Comercializadoras
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-gray-900">
                {comercializadora.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
