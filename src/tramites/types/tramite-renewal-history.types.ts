export interface TramiteRenewalHistory {
  id: string;
  tramite_id: string;
  renewal_number: number;
  user_id: string | null;
  previous_activation_date: string | null;
  previous_renovation_date: string | null;
  new_activation_date: string;
  new_renovation_date: string;
  previous_status: string | null;
  previous_liquidez_status: string | null;
  company_changed: boolean;
  previous_company: string | null;
  new_company: string | null;
  created_at: string;
  user_name?: string | null;
}
