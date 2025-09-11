/**
 * Types for tramite changes tracking system
 */

export type TramiteChangeType =
  | "created"
  | "status_change"
  | "field_update"
  | "client_update"
  | "signer_update"
  | "document_upload"
  | "document_delete"
  | "note_added"
  | "assignment_change"
  | "contract_created"
  | "contract_updated"
  | "contract_deleted"
  | "commission_update"
  | "date_update"
  | "provider_update"
  | "renewal_created"
  | "renewal_updated";

export interface TramiteChange {
  id: string;
  tramite_id: string;
  user_id: string;
  change_type: TramiteChangeType;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
  // Joined fields from user table
  user_name?: string | null;
  user_last_name?: string | null;
}

export interface TramiteChangeWithUser extends TramiteChange {
  user_name: string | null;
  user_last_name: string | null;
}
