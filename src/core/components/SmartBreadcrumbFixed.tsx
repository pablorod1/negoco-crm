"use client";

import React, { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/core/utils";
import {
  BreadcrumbEnhanced,
  BreadcrumbEnhancedList,
  BreadcrumbEnhancedItem,
  BreadcrumbEnhancedLink,
  BreadcrumbEnhancedPage,
  BreadcrumbEnhancedSeparator,
  BreadcrumbEnhancedEllipsis,
} from "@/core/components/ui/breadcrumb-enhanced";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu";
import { Button } from "@/core/components/ui/button";
import { useBreadcrumb, BreadcrumbItem } from "@/core/hooks/useBreadcrumb";

interface SmartBreadcrumbProps {
  className?: string;
  showBackButton?: boolean;
  maxItems?: number;
  variant?: "default" | "compact" | "minimal";
}

type DisplayItem =
  | BreadcrumbItem
  | {
      type: "ellipsis";
      hiddenItems: BreadcrumbItem[];
    };

export default function SmartBreadcrumb({
  className,
  showBackButton = true,
  maxItems = 3,
  variant = "default",
}: SmartBreadcrumbProps) {
  const router = useRouter();
  const { items, contextInfo } = useBreadcrumb();

  // Memoizar la función de navegación hacia atrás
  const handleBack = useCallback(() => {
    if (items.length > 1) {
      const parentItem = items[items.length - 2];
      router.push(parentItem.href);
    } else {
      router.back();
    }
  }, [items, router]);

  // Memoizar los elementos a mostrar para evitar recálculos innecesarios
  const displayItems = useMemo((): DisplayItem[] => {
    if (items.length <= maxItems) {
      return items;
    }

    const firstItem = items[0];
    const lastItems = items.slice(-2);
    const hiddenItems = items.slice(1, -2);

    return [firstItem, { type: "ellipsis", hiddenItems }, ...lastItems];
  }, [items, maxItems]);

  // Componente para renderizar elementos ocultos en el dropdown
  const EllipsisDropdown = useMemo(() => {
    const Component = ({ hiddenItems }: { hiddenItems: BreadcrumbItem[] }) => (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center">
          <BreadcrumbEnhancedEllipsis />
          <span className="sr-only">Más elementos</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {hiddenItems.map((hiddenItem, hiddenIndex) => {
            const IconComponent = hiddenItem.icon;
            return (
              <DropdownMenuItem key={hiddenIndex}>
                <BreadcrumbEnhancedLink
                  href={hiddenItem.href}
                  className="flex items-center gap-2"
                >
                  {IconComponent && <IconComponent className="w-4 h-4" />}
                  {hiddenItem.title}
                </BreadcrumbEnhancedLink>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
    Component.displayName = "EllipsisDropdown";
    return Component;
  }, []);

  // Componente para renderizar un elemento de breadcrumb individual
  const BreadcrumbItemComponent = useCallback(
    ({ item }: { item: BreadcrumbItem }) => {
      const showIcon = variant !== "minimal" && item.icon;
      const titleClassName = cn(variant === "compact" && "hidden sm:inline");
      const IconComponent = item.icon;

      if (item.isCurrentPage) {
        return (
          <BreadcrumbEnhancedPage className="flex items-center gap-2">
            {showIcon && IconComponent && <IconComponent className="w-4 h-4" />}
            <span className={titleClassName}>{item.title}</span>
          </BreadcrumbEnhancedPage>
        );
      }

      return (
        <BreadcrumbEnhancedLink
          href={item.href}
          className="flex items-center gap-2 hover:bg-muted/50 rounded-md px-2 py-1 transition-colors"
        >
          {showIcon && IconComponent && <IconComponent className="w-4 h-4" />}
          <span className={titleClassName}>{item.title}</span>
        </BreadcrumbEnhancedLink>
      );
    },
    [variant]
  );

  // Renderizar el breadcrumb principal - memoizado para mejor rendimiento
  const breadcrumbContent = useMemo(
    () => (
      <BreadcrumbEnhanced className={cn("", className)}>
        <BreadcrumbEnhancedList>
          {displayItems.map((item, index) => {
            if ("type" in item && item.type === "ellipsis") {
              return (
                <React.Fragment key="ellipsis">
                  <BreadcrumbEnhancedSeparator />
                  <BreadcrumbEnhancedItem>
                    <EllipsisDropdown hiddenItems={item.hiddenItems} />
                  </BreadcrumbEnhancedItem>
                </React.Fragment>
              );
            }

            const breadcrumbItem = item as BreadcrumbItem;
            return (
              <React.Fragment key={breadcrumbItem.href}>
                {index > 0 && <BreadcrumbEnhancedSeparator />}
                <BreadcrumbEnhancedItem>
                  <BreadcrumbItemComponent item={breadcrumbItem} />
                </BreadcrumbEnhancedItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbEnhancedList>
      </BreadcrumbEnhanced>
    ),
    [displayItems, className, EllipsisDropdown, BreadcrumbItemComponent]
  );

  // Renderizar información contextual - memoizada y simplificada
  const contextContent = useMemo(() => {
    if (
      variant === "minimal" ||
      !contextInfo.description ||
      variant !== "default"
    ) {
      return null;
    }

    return (
      <div className="flex items-center gap-3 mt-2">
        <span className="text-sm text-muted-foreground hidden md:inline">
          {contextInfo.description}
        </span>
      </div>
    );
  }, [variant, contextInfo.description]);

  // Botón de retroceso - memoizado
  const backButton = useMemo(() => {
    if (!showBackButton || items.length <= 1) return null;

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="flex items-center gap-2 px-2"
      >
        <ArrowLeft className="w-4 h-4" />
        {variant === "default" && (
          <span className="hidden sm:inline">Volver</span>
        )}
      </Button>
    );
  }, [showBackButton, items.length, handleBack, variant]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-3">
        {backButton}
        <div className="flex-1 min-w-0">{breadcrumbContent}</div>
      </div>
      {contextContent}
    </div>
  );
}
