"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getAllFoldersWithPaths } from "@/lib/firebase/data/getFolders";
import { useDocumentacion } from "@/lib/contexts/DocumentacionContext";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Image from "next/image";
import { useUser } from "@/lib/contexts/UserContext";

interface FolderStructure {
  path: string;
  displayName: string;
  level: number;
  parent: string;
  subfolders: FolderStructure[];
}

interface FolderGroup {
  name: string;
  path: string;
  subfolders: FolderStructure[];
}

export default function DocumentacionSidebar() {
  const { userData } = useUser();
  const [folderGroups, setFolderGroups] = useState<FolderGroup[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["/"])
  );
  const [isOpen, setIsOpen] = useState(false);
  const { setRefreshDocumentacion } = useDocumentacion();

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const fetchFolders = React.useCallback(async () => {
    try {
      const { success, data: folders } = await getAllFoldersWithPaths(
        userData?.organization.id as string
      );
      if (success && folders) {
        const folderMap: Record<string, FolderStructure> = {};
        const groups: Record<string, FolderGroup> = {
          root: { name: "Raíz", path: "", subfolders: [] },
        };

        // First pass: create all folder objects
        folders.forEach((path) => {
          const parts = path.split("/");
          const level = parts.length;
          const name = parts[parts.length - 1];
          const parent = parts.slice(0, -1).join("/");

          folderMap[path] = {
            path,
            displayName: name,
            level,
            parent,
            subfolders: [],
          };

          if (level === 1) {
            groups[path] = {
              name,
              path,
              subfolders: [],
            };
          }
        });

        // Second pass: build the hierarchy
        Object.values(folderMap).forEach((folder) => {
          if (folder.parent) {
            if (folder.level === 2) {
              const topLevelParent = folder.path.split("/")[0];
              if (groups[topLevelParent]) {
                groups[topLevelParent].subfolders.push(folder);
              }
            } else {
              const parentFolder = folderMap[folder.parent];
              if (parentFolder) {
                parentFolder.subfolders.push(folder);
              }
            }
          }
        });

        // Sort folders
        const sortFolders = (folders: FolderStructure[]) => {
          folders.sort((a, b) => a.displayName.localeCompare(b.displayName));
          folders.forEach((folder) => {
            if (folder.subfolders.length > 0) {
              sortFolders(folder.subfolders);
            }
          });
        };

        Object.values(groups).forEach((group) => {
          sortFolders(group.subfolders);
        });

        setFolderGroups(Object.values(groups));
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
    }
  }, [userData]);

  useEffect(() => {
    return setRefreshDocumentacion(fetchFolders);
  }, [fetchFolders, setRefreshDocumentacion]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const renderSubfolders = (
    subfolders: FolderStructure[],
    padding: number = 16
  ) => {
    return subfolders.map((subfolder) => (
      <li className="flex flex-col w-full" key={subfolder.path}>
        <div
          className="flex items-center justify-between w-full"
          style={{ paddingLeft: padding }}
        >
          <Link
            className="flex items-center justify-between w-full"
            href={`/documentacion/${subfolder.path}`}
          >
            <div className="flex items-center gap-4">
              <Image
                src="/file-icons/folder.png"
                alt="folder"
                width={16}
                height={16}
              />
              <span className="text-sm text-nowrap">
                {subfolder.displayName}
              </span>
            </div>
          </Link>
          <Button
            size="icon"
            className="bg-transparent"
            onClick={() => {
              if (subfolder.subfolders.length > 0) {
                toggleFolder(subfolder.path);
              }
            }}
          >
            {subfolder.subfolders.length > 0 ? (
              expandedFolders.has(subfolder.path) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <div className="w-4" />
            )}
          </Button>
        </div>
        {subfolder.subfolders.length > 0 && (
          <ul
            className={`mt-2 animate-size transition-all duration-200 ease-in-out overflow-hidden ${
              expandedFolders.has(subfolder.path) ? "h-auto" : "h-0"
            }`}
          >
            {renderSubfolders(subfolder.subfolders, padding + 16)}
          </ul>
        )}
      </li>
    ));
  };

  return (
    <div
      className={`animate-size transition-all duration-300 h-full bg-background border-r flex flex-col max-w-96 ${
        isOpen ? "w-full" : "w-64"
      }`}
    >
      <nav className="flex-1 overflow-y-auto">
        <ul className="space-y-2 px-2 py-4">
          <li>
            <Link
              href="/documentacion"
              className="w-full flex items-center px-4 gap-4"
            >
              <Image
                src="/file-icons/disco.png"
                alt="folder"
                width={16}
                height={16}
              />
              <span>Inicio</span>
            </Link>
          </li>

          <li className="mt-6">
            <Collapsible
              open={isOpen}
              onOpenChange={setIsOpen}
              disabled={folderGroups.length < 2}
            >
              <CollapsibleTrigger asChild className="mb-1">
                <Button variant="ghost" className="w-full flex justify-start">
                  <span className="flex items-center gap-4">
                    <Image
                      src="/file-icons/folder.png"
                      alt="folder"
                      width={16}
                      height={16}
                    />
                    <span className="text-sm">Carpetas</span>
                  </span>
                  {folderGroups.length > 1 &&
                    (isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    ))}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="ms-8 space-y-2">
                  {folderGroups.map((group) =>
                    group.path ? (
                      <li className="flex flex-col w-full" key={group.path}>
                        <div className="flex items-center justify-between">
                          <Link
                            className="flex items-center justify-between"
                            href={`/documentacion/${group.path}`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-4">
                                <Image
                                  src="/file-icons/folder.png"
                                  alt="folder"
                                  width={16}
                                  height={16}
                                />
                                <span className="text-sm">{group.name}</span>
                              </div>
                            </div>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-black"
                            onClick={() => {
                              if (group.subfolders.length > 0) {
                                toggleFolder(group.path);
                              }
                            }}
                          >
                            {group.subfolders.length > 0 ? (
                              expandedFolders.has(group.path) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )
                            ) : null}
                          </Button>
                        </div>

                        {group.subfolders.length > 0 && (
                          <ul
                            className={`mt-2 animate-size transition-all duration-200 ease-in-out overflow-hidden ${
                              expandedFolders.has(group.path) ? "h-auto" : "h-0"
                            }`}
                          >
                            {renderSubfolders(group.subfolders)}
                          </ul>
                        )}
                      </li>
                    ) : null
                  )}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </li>
        </ul>
      </nav>
    </div>
  );
}
