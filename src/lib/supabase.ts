import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://txjcxytzjgindzysakns.supabase.co';

const supabaseAnonKey =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4amN4eXR6amdpbmR6eXNha25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDg4NTYsImV4cCI6MjA5MjcyNDg1Nn0._7vpYZkza-14saGZcGEaWlwWXHP9C8cHXoTb-A3aH8U';

export const FIPE_API_URL =
'https://parallelum.com.br/fipe/api/v1';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Tipos do banco de dados
export type Company = {
  id: string;
  name: string;
  slug: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  logo_url?: string;
  primary_color?: string;
  status: 'active' | 'inactive' | 'suspended';
  plan: 'basic' | 'pro' | 'enterprise';
  max_vehicles: number;
  max_users: number;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'vendedor' | 'administrador';
  company_id?: string;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: string;
  company_id?: string;
  brand: string;
  model: string;
  year: number;
  version?: string;
  purchase_price: number;
  sale_price: number;
  fipe_code?: string;
  fipe_value?: number;
  status: 'disponivel' | 'em_negociacao' | 'vendido';
  color?: string;
  plate?: string;
  mileage?: number;
  fuel_type?: string;
  transmission?: string;
  description?: string;
  images?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type VehicleCost = {
  id: string;
  vehicle_id: string;
  cost_type: 'manutencao' | 'estetica' | 'mecanica' | 'revisao' | 'laudo' | 'outro';
  description: string;
  amount: number;
  service_date?: string;
  created_by?: string;
  created_at: string;
};

export type Negotiation = {
  id: string;
  vehicle_id: string;
  seller_id: string;
  company_id?: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_cpf?: string;
  stage:
   | 'primeiro_contato'
   | 'avaliacao'
   | 'test_drive_agendado'
   | 'test_drive_realizado'
   | 'proposta_enviada'
   | 'negociacao_preco'
   | 'aprovacao_credito'
   | 'documentacao'
   | 'finalizado'
   | 'perdido';
  offered_price?: number;
  notes?: string;
  priority: 'baixa' | 'media' | 'alta';
  created_at: string;
  updated_at: string;
};

export type InteractionHistory = {
  id: string;
  negotiation_id: string;
  vehicle_id: string;
  user_id: string;
  interaction_type:
   | 'ligacao'
   | 'whatsapp'
   | 'email'
   | 'visita'
   | 'test_drive'
   | 'proposta'
   | 'observacao'
   | 'outro';
  description: string;
  created_at: string;
};

export type Sale = {
  id: string;
  negotiation_id: string;
  vehicle_id: string;
  seller_id: string;
  company_id?: string;
  final_price: number;
  payment_method?: string;
  commission?: number;
  sale_date: string;
  created_at: string;
};

export type Customer = {
  id: string;
  user_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  cpf?: string;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  company_id: string;
  vehicle_id?: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  message?: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
};

export type TradeInVehicle = {
  id: string;
  negotiation_id: string;
  company_id: string;
  brand: string;
  model: string;
  year: number;
  version?: string;
  plate?: string;
  mileage?: number;
  color?: string;
  fuel_type?: string;
  transmission?: string;
  condition_notes?: string;
  evaluated_value?: number;
  offered_value?: number;
  evaluator_name?: string;
  evaluation_date?: string;
  images?: string[];
  needs_evaluation: boolean;
  created_at: string;
  updated_at: string;
};
