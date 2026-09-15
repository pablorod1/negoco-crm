export type DelayUnit = "minutes" | "hours" | "days";

export interface CrmProviderOption {
  id: string;
  name: string;
  normalized_name: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProcessingAutoActivationSettings {
  enabled: boolean;
  delay_minutes: number;
  delay_value: number;
  delay_unit: DelayUnit;
}

export interface CrmSettings {
  providers: CrmProviderOption[];
  processing_auto_activation: ProcessingAutoActivationSettings;
}

export type ProcessingJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "canceled"
  | "skipped"
  | "failed";

export interface ProcessingJob {
  id: string;
  tenant_slug: string;
  tenant_host: string;
  tramite_id: string;
  processing_date: string;
  due_at: string;
  status: ProcessingJobStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}
