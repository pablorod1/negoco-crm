"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { useUser } from "@/core/contexts/UserContext";
import { cn } from "@/core/utils";
import type {
  ApiResponse,
  DashboardAnnouncement,
} from "@/dashboard-announcements/types";
import { variantConfig } from "@/dashboard-announcements/variants";
import AnnouncementCard from "@/dashboard-announcements/components/AnnouncementCard";
import DashboardAnnouncementConfigPanel from "@/dashboard-announcements/components/DashboardAnnouncementConfigPanel";
import { ChevronDown, Megaphone, Pencil } from "lucide-react";

export default function DashboardAnnouncementFloating() {
  const { userData } = useUser();
  const [announcement, setAnnouncement] =
    useState<DashboardAnnouncement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const canEdit = userData?.role === "admin";

  useEffect(() => {
    let isMounted = true;

    const fetchAnnouncement = async () => {
      try {
        const response = await fetch("/api/v2/dashboard-announcements/active");
        const result =
          (await response.json()) as ApiResponse<DashboardAnnouncement | null>;

        if (isMounted && result.success) {
          setAnnouncement(result.data || null);
        }
      } catch (error) {
        console.error("Error loading dashboard announcement:", error);
      } finally {
        if (isMounted) {
          setLoaded(true);
        }
      }
    };

    fetchAnnouncement();

    return () => {
      isMounted = false;
    };
  }, []);

  // Animación de entrada cuando el cartel se muestra desplegado.
  useEffect(() => {
    if (loaded && announcement && !collapsed) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [loaded, announcement, collapsed]);

  if (!loaded || !announcement || typeof document === "undefined") {
    return null;
  }

  const config = variantConfig[announcement.variant];

  if (collapsed) {
    return createPortal(
      <button
        type="button"
        aria-label="Mostrar cartel"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary-900 text-white shadow-lg shadow-gray-900/25 transition-transform hover:scale-105"
      >
        <Megaphone className="size-5" />
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 size-3.5 animate-ping rounded-full",
            config.accent,
          )}
        />
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 size-3.5 rounded-full ring-2 ring-white",
            config.accent,
          )}
        />
      </button>,
      document.body,
    );
  }

  const actions = (
    <>
      {canEdit ? (
        <button
          type="button"
          aria-label="Editar cartel"
          onClick={() => setEditOpen(true)}
          className="flex size-7 items-center justify-center rounded-full bg-white/70 text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
        >
          <Pencil className="size-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Colapsar cartel"
        onClick={() => {
          setVisible(false);
          setCollapsed(true);
        }}
        className="flex size-7 items-center justify-center rounded-full bg-white/70 text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
      >
        <ChevronDown className="size-4" />
      </button>
    </>
  );

  return createPortal(
    <>
      <aside
        aria-live="polite"
        className={cn(
          "fixed bottom-4 left-4 right-4 z-40 transition-all duration-300 ease-out sm:left-auto sm:w-[420px]",
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <AnnouncementCard
          variant={announcement.variant}
          title={announcement.title}
          message={announcement.message}
          ctaLabel={announcement.cta_label}
          ctaUrl={announcement.cta_url}
          actions={actions}
          className="shadow-xl shadow-gray-900/10"
        />
      </aside>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cartel del dashboard</DialogTitle>
            <DialogDescription>
              Los cambios se aplican al panel visible para todos los usuarios.
            </DialogDescription>
          </DialogHeader>
          <DashboardAnnouncementConfigPanel
            compact
            showStatus={false}
            initialAnnouncement={announcement}
            onSaved={(updatedAnnouncement) => {
              setAnnouncement(updatedAnnouncement);
              setEditOpen(false);
            }}
            onDeactivated={() => {
              setAnnouncement(null);
              setEditOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>,
    document.body,
  );
}
