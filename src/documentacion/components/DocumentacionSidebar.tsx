"use client";

import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/core/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/core/components/ui/collapsible";
import { cn } from "@/core/utils";
import { SupplierLogo } from "@/comercializadoras/components/SupplierLogo";
import { useDocumentLibraryFolderTree } from "@/documentacion/hooks/useDocumentLibraryFolderTree";
import { FolderNode } from "@/documentacion/lib/folder-tree";

function folderHref(path: string) {
  return `/documentacion/${path}`;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function FolderIcon({ node }: { node: FolderNode }) {
  if (node.supplier) {
    return <SupplierLogo supplier={node.supplier} size={20} />;
  }
  return (
    <Image src="/file-icons/folder.png" alt="" width={16} height={16} />
  );
}

interface SidebarFolderItemProps {
  node: FolderNode;
  depth: number;
  currentPath: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function SidebarFolderItem({
  node,
  depth,
  currentPath,
  expanded,
  onToggle,
}: SidebarFolderItemProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.path);
  const isActive = currentPath === node.path;

  return (
    <li className="flex w-full flex-col">
      <div
        className={cn(
          "flex items-center justify-between rounded-md pe-1",
          isActive && "bg-primary-50"
        )}
        style={{ paddingLeft: depth * 16 }}
      >
        <Link
          href={folderHref(node.path)}
          title={node.virtual ? `${node.name} · sin documentos` : node.name}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5 text-sm",
            isActive ? "font-medium text-primary-800" : "text-gray-700",
            node.virtual && !isActive && "text-gray-400"
          )}
        >
          <FolderIcon node={node} />
          <span className="truncate">{node.name}</span>
        </Link>
        {hasChildren && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-gray-500"
            aria-label={isExpanded ? "Contraer" : "Expandir"}
            aria-expanded={isExpanded}
            onClick={() => onToggle(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="mt-1 space-y-1">
          {node.children.map((child) => (
            <SidebarFolderItem
              key={child.path}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface SidebarSectionProps {
  title: string;
  icon: React.ReactNode;
  nodes: FolderNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function SidebarSection({
  title,
  icon,
  nodes,
  open,
  onOpenChange,
  currentPath,
  expanded,
  onToggle,
}: SidebarSectionProps) {
  if (nodes.length === 0) return null;

  return (
    <li>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild className="mb-1">
          <Button
            variant="ghost"
            className="flex w-full justify-between"
            aria-expanded={open}
          >
            <span className="flex items-center gap-4">
              {icon}
              <span className="text-sm">{title}</span>
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="ms-4 space-y-1">
            {nodes.map((node) => (
              <SidebarFolderItem
                key={node.path}
                node={node}
                depth={0}
                currentPath={currentPath}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

export default function DocumentacionSidebar() {
  const pathname = usePathname();
  const { tree } = useDocumentLibraryFolderTree();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [suppliersOpen, setSuppliersOpen] = useState(true);
  const [foldersOpen, setFoldersOpen] = useState(false);

  const currentPath = safeDecode(pathname.replace(/^\/documentacion\/?/, ""));

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const isWide = suppliersOpen || foldersOpen;

  return (
    <div
      className={cn(
        "animate-size flex h-full shrink-0 max-w-96 flex-col border-r bg-background transition-all duration-300",
        isWide ? "w-full" : "w-64"
      )}
    >
      <nav className="flex-1 overflow-y-auto overscroll-contain">
        <ul className="space-y-2 px-2 py-4">
          <li>
            <Link
              href="/documentacion"
              className={cn(
                "flex w-full items-center gap-4 rounded-md px-4 py-1.5",
                currentPath === "" && "bg-primary-50 font-medium text-primary-800"
              )}
            >
              <Image
                src="/file-icons/disco.png"
                alt=""
                width={16}
                height={16}
              />
              <span>Inicio</span>
            </Link>
          </li>

          <li className="mt-6">
            <ul className="space-y-2">
              <SidebarSection
                title="Comercializadoras"
                icon={<Building2 className="h-4 w-4 text-gray-600" />}
                nodes={tree.supplierFolders}
                open={suppliersOpen}
                onOpenChange={setSuppliersOpen}
                currentPath={currentPath}
                expanded={expanded}
                onToggle={toggleFolder}
              />
              <SidebarSection
                title="Carpetas"
                icon={
                  <Image
                    src="/file-icons/folder.png"
                    alt=""
                    width={16}
                    height={16}
                  />
                }
                nodes={tree.otherFolders}
                open={foldersOpen}
                onOpenChange={setFoldersOpen}
                currentPath={currentPath}
                expanded={expanded}
                onToggle={toggleFolder}
              />
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}
