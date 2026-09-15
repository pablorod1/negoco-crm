export type DashboardAnnouncementVariant =
  | "info"
  | "warning"
  | "success"
  | "danger";

export interface DashboardAnnouncement {
  id: string;
  title: string;
  message: string;
  variant: DashboardAnnouncementVariant;
  cta_label: string | null;
  cta_url: string | null;
  is_active: boolean;
  created_by: string;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
}

export interface DashboardAnnouncementPayload {
  title: string;
  message: string;
  variant: DashboardAnnouncementVariant;
  cta_label?: string | null;
  cta_url?: string | null;
}

export interface UpdateDashboardAnnouncementPayload
  extends Partial<DashboardAnnouncementPayload> {
  is_active?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
