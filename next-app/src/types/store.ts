export interface Store {
  id: string;
  name: string;
  businessTypeId?: string;
  businessTypeName?: string;
  businessTypeDescription?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}