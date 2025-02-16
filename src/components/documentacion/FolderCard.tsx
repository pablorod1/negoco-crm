"use client";

import { MoreVertical } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteFolder } from "@/lib/firebase/data/deleteFolder";
import toast from "react-hot-toast";
import { useDocumentacion } from "@/contexts/DocumentacionContext";
import Image from "next/image";

interface FolderCardProps {
  name: string;
  currentPath: string;
}

export function FolderCard({ name, currentPath }: FolderCardProps) {
  const { refreshDocumentacion } = useDocumentacion();

  const handleDelete = async () => {
    try {
      const { success, errors } = await deleteFolder(
        `${currentPath ? `${currentPath}/` : ""}${name}`
      );

      if (!success) {
        toast.error(errors);
        return;
      }

      toast.success("Carpeta eliminada correctamente");
      refreshDocumentacion();
    } catch (error) {
      console.error("Error eliminando carpeta:", error);
      toast.error("Error eliminando carpeta");
    }
  };
  return (
    <Card className="relative overflow-hidden h-full flex items-center w-full">
      <CardContent className="p-4 w-full">
        <div className="flex items-start justify-between">
          <Link
            href={`/documentacion/${currentPath}/${name}`}
            className="flex items-center space-x-4 group"
          >
            <div className="w-14 h-14 relative">
              <Image
                src="/file-icons/folder.png"
                alt="Folder icon"
                layout="fill"
                objectFit="contain"
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg group-hover:underline">
                {name}
              </h3>
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Rename</DropdownMenuItem>
              <DropdownMenuItem>Move</DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-danger"
                onClick={handleDelete}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
