import { useState, useEffect, useRef } from 'react';
import { supabase, Vehicle, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';

type ManualLeadFormProps = {
  open?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const selectClass =
  'w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

const initialFormData = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  message: '',
  vehicle_id: '',
  assigned_to: '',
};

export function ManualLeadForm({ open = true, onClose, onSuccess }: ManualLeadFormProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [formData, setFormData] = useState(initialFormData);

  const isAdmin = profile?.role === 'administrador';

  useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setError('');
      setLoading(false);
      if (profile?.company_id) {
        loadVehicles();
        if (isAdmin) {
          loadSellers();
        }
      }
    }
  }, [open, profile?.company_id, isAdmin]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      errorRef.current.focus();
    }
  }, [error]);

  const loadVehicles = async () => {
    try {
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('status', 'disponivel')
        .order('brand');
      if (data) setVehicles(data);
    } catch (err) {
      console.error('Error loading vehicles:', err);
    }
  };

  const loadSellers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('role', 'vendedor')
        .order('full_name');
      if (data) setSellers(data);
    } catch (err) {
      console.error('Error loading sellers:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = formData.customer_name.trim();
    const email = formData.customer_email.trim();
    const phone = formData.customer_phone.trim();
    const message = formData.message.trim();

    if (!name) {
      setError('Informe o nome do cliente.');
      return;
    }

    if (!email && !phone) {
      setError('Informe ao menos um meio de contato (e-mail ou telefone).');
      return;
    }

    if (!profile?.company_id) {
      setError('Usuário sem loja vinculada.');
      return;
    }

    setLoading(true);

    try {
      const assignedTo = isAdmin
        ? (formData.assigned_to || null)
        : (user?.id || null);

      const payload = {
        company_id: profile.company_id,
        vehicle_id: formData.vehicle_id || null,
        customer_name: name,
        customer_email: email || null,
        customer_phone: phone || null,
        message: message || null,
        source: 'manual',
        status: 'new' as const,
        assigned_to: assignedTo,
      };

      const { error: insertError } = await supabase.from('leads').insert([payload]);

      if (insertError) throw insertError;

      toast.success('Lead cadastrado com sucesso!');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error inserting manual lead:', err);
      setError(err?.message || 'Erro ao cadastrar lead.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !loading) onClose(); }}>
      <DialogContent
        className="sm:max-w-xl max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(e) => { if (loading) e.preventDefault(); }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="pr-6">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Novo Lead
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Cadastre um cliente que ligou ou compareceu à loja.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3 outline-none"
          >
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual_lead_name">Nome do cliente *</Label>
            <Input
              id="manual_lead_name"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              placeholder="Ex.: Carlos Souza"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual_lead_email">E-mail</Label>
              <Input
                type="email"
                id="manual_lead_email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                placeholder="cliente@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual_lead_phone">Telefone</Label>
              <Input
                type="tel"
                id="manual_lead_phone"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            * É obrigatório informar pelo menos o e-mail ou o telefone.
          </p>

          <div className="space-y-2">
            <Label htmlFor="manual_lead_vehicle">Veículo de interesse (opcional)</Label>
            <select
              id="manual_lead_vehicle"
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              className={selectClass}
            >
              <option value="">Nenhum veículo selecionado (interesse geral)</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} {v.year} - {brl(v.sale_price)}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="manual_lead_assigned_to">Vendedor responsável</Label>
              <select
                id="manual_lead_assigned_to"
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className={selectClass}
              >
                <option value="">Sem vendedor atribuído</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="manual_lead_message">Observações / Mensagem</Label>
            <Textarea
              id="manual_lead_message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={3}
              placeholder="Detalhes sobre o contato, proposta ou preferência do cliente..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Cadastrando...' : 'Cadastrar Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
