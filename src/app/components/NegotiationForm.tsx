import { useState, useEffect, useRef } from 'react';
import { supabase, Lead, Vehicle } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { formatStage, stageLabels } from '../../lib/format';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type NegotiationFormProps = {
  open?: boolean;
  onClose: () => void;
  initialVehicle?: Pick<Vehicle, 'id' | 'brand' | 'model' | 'year' | 'status' | 'sale_price'> | null;
  lead?: (Pick<Lead, 'id' | 'customer_name' | 'customer_phone' | 'customer_email' | 'message' | 'vehicle_id'> & {
    vehicle?: Pick<Vehicle, 'status' | 'brand' | 'model' | 'year'> | null;
  }) | null;
  onCreated?: (negotiationId: string) => void;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const selectClass =
  'w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

const isValidCpf = (value: string) => {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, number, index) => total + Number(number) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
};

const parseMoney = (value: string) => {
  const clean = value.trim().replace(/[^\d,.-]/g, '');
  if (!clean) return Number.NaN;

  const comma = clean.lastIndexOf(',');
  const dot = clean.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    return Number(clean.replace(thousandsSeparator, '').replace(decimalSeparator, '.'));
  }
  if (comma >= 0) return Number(clean.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, ''));
  return Number(clean);
};

const formatMoney = (value: number) => value.toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const initialFormData = {
  vehicle_id: '',
  client_name: '',
  client_phone: '',
  client_email: '',
  client_cpf: '',
  stage: 'primeiro_contato' as any,
  offered_price: '',
  notes: '',
  priority: 'media' as 'baixa' | 'media' | 'alta'
};

export function NegotiationForm({ open = true, onClose, lead, initialVehicle, onCreated }: NegotiationFormProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (open) {
      setFormData({
        ...initialFormData,
        client_name: lead?.customer_name || '',
        client_phone: lead?.customer_phone || '',
        client_email: lead?.customer_email || '',
        notes: lead?.message || '',
        vehicle_id: lead?.vehicle_id || initialVehicle?.id || '',
      });
      setError('');
      setLoading(false);
      if (profile?.company_id) loadVehicles();
    }
  }, [open, profile?.company_id, lead, initialVehicle]);

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
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.client_cpf && !isValidCpf(formData.client_cpf)) {
      setError('CPF inválido. Confira os números digitados.');
      return;
    }

    const offeredPrice = formData.offered_price.trim() ? parseMoney(formData.offered_price) : null;
    if (offeredPrice !== null && (!Number.isFinite(offeredPrice) || offeredPrice < 0)) {
      setError('Informe um valor proposto válido. Exemplo: 180.000,00.');
      return;
    }

    setLoading(true);

    try {
      let negotiationId: string;
      if (lead) {
        const { data, error: conversionError } = await supabase.rpc('convert_lead_to_negotiation', {
          p_lead_id: lead.id,
          p_vehicle_id: formData.vehicle_id,
          p_client_cpf: formData.client_cpf || null,
          p_stage: formData.stage,
          p_offered_price: offeredPrice,
          p_notes: formData.notes || null,
          p_priority: formData.priority,
        });
        if (conversionError) throw conversionError;
        negotiationId = data as string;
      } else {
        const { data, error: negError } = await supabase.from('negotiations').insert([
          {
          company_id: profile?.company_id || null,
          vehicle_id: formData.vehicle_id,
          seller_id: user?.id,
          client_name: formData.client_name,
          client_phone: formData.client_phone || null,
          client_email: formData.client_email || null,
          client_cpf: formData.client_cpf || null,
          stage: formData.stage,
          offered_price: offeredPrice,
          notes: formData.notes || null,
          priority: formData.priority
          }
        ]).select('id').single();

        if (negError) throw negError;
        negotiationId = data.id;

        await supabase
          .from('vehicles')
          .update({ status: 'em_negociacao' })
          .eq('id', formData.vehicle_id)
          .eq('company_id', profile!.company_id!);
      }

      if (lead) toast.success('Lead escalado para negociação.');
      onCreated?.(negotiationId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar negociação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !loading) onClose(); }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(e) => { if (loading) e.preventDefault(); }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="pr-6">
          <DialogTitle className="text-2xl font-bold text-foreground">
            {lead ? 'Escalar lead para negociação' : 'Nova Negociação'}
          </DialogTitle>
          <DialogDescription>
            {lead
              ? 'Revise os dados do cliente, escolha um veículo disponível e inicie o atendimento comercial.'
              : 'Selecione o veículo e informe os dados do cliente e da proposta.'}
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="vehicle_id">Veículo *</Label>
              <select
                id="vehicle_id"
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                required
                className={selectClass}
              >
                <option value="">Selecione um veículo</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} {vehicle.year} - {brl(vehicle.sale_price)}
                  </option>
                ))}
                {initialVehicle && !vehicles.some((vehicle) => vehicle.id === initialVehicle.id) && (
                  <option value={initialVehicle.id}>
                    {initialVehicle.brand} {initialVehicle.model} {initialVehicle.year} - {brl(initialVehicle.sale_price)}
                  </option>
                )}
                {lead?.vehicle_id && !vehicles.some((vehicle) => vehicle.id === lead.vehicle_id) && (
                  <option value={lead.vehicle_id}>
                    {lead.vehicle
                      ? `${lead.vehicle.brand} ${lead.vehicle.model} ${lead.vehicle.year} - indisponível`
                      : 'Veículo de interesse do lead - indisponível'}
                  </option>
                )}
              </select>
              {lead?.vehicle_id && lead.vehicle?.status !== 'disponivel' && (
                <p className="text-xs text-destructive">
                  O veículo relacionado ao lead não está disponível. Selecione outro veículo para continuar.
                </p>
              )}
              {vehicles.length === 0 && (
                <p className="text-xs text-primary">Nenhum veículo disponível para negociação</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="client_name">Nome do Cliente *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                required
                placeholder="João Silva"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_phone">Telefone</Label>
              <Input
                type="tel"
                id="client_phone"
                value={formData.client_phone}
                onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_email">Email</Label>
              <Input
                type="email"
                id="client_email"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                placeholder="cliente@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_cpf">CPF</Label>
              <Input
                id="client_cpf"
                value={formData.client_cpf}
                onChange={(e) => setFormData({ ...formData, client_cpf: formatCpf(e.target.value) })}
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">Estágio *</Label>
              <select
                id="stage"
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                className={selectClass}
              >
                {Object.entries(stageLabels).filter(([stage]) => !['finalizado', 'perdido'].includes(stage)).map(([value]) => (
                  <option key={value} value={value}>{formatStage(value)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade *</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className={selectClass}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="offered_price">Valor Proposto (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                id="offered_price"
                value={formData.offered_price}
                onChange={(e) => setFormData({ ...formData, offered_price: e.target.value })}
                onBlur={() => {
                  const parsed = parseMoney(formData.offered_price);
                  if (Number.isFinite(parsed)) {
                    setFormData((current) => ({ ...current, offered_price: formatMoney(parsed) }));
                  }
                }}
                placeholder="200.000,00"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Anotações sobre a negociação..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || vehicles.length === 0} className="flex-1">
              {loading ? 'Criando...' : 'Criar Negociação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
