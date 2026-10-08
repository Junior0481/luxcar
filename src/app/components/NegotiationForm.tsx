import { useState, useEffect, useRef } from 'react';
import { supabase, Vehicle } from '../../lib/supabase';
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

type NegotiationFormProps = {
  open?: boolean;
  onClose: () => void;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const selectClass =
  'w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

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

export function NegotiationForm({ open = true, onClose }: NegotiationFormProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setError('');
      setLoading(false);
      if (profile?.company_id) loadVehicles();
    }
  }, [open, profile?.company_id]);

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
    setLoading(true);

    try {
      const { error: negError } = await supabase.from('negotiations').insert([
        {
          company_id: profile?.company_id || null,
          vehicle_id: formData.vehicle_id,
          seller_id: user?.id,
          client_name: formData.client_name,
          client_phone: formData.client_phone || null,
          client_email: formData.client_email || null,
          client_cpf: formData.client_cpf || null,
          stage: formData.stage,
          offered_price: formData.offered_price ? parseFloat(formData.offered_price) : null,
          notes: formData.notes || null,
          priority: formData.priority
        }
      ]).select('id').single();

      if (negError) throw negError;

      await supabase
        .from('vehicles')
        .update({ status: 'em_negociacao' })
        .eq('id', formData.vehicle_id)
        .eq('company_id', profile!.company_id!);

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
            Nova Negociação
          </DialogTitle>
          <DialogDescription className="sr-only">
            Selecione o veículo e informe os dados do cliente e da proposta.
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
              </select>
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
                onChange={(e) => setFormData({ ...formData, client_cpf: e.target.value })}
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
                <option value="primeiro_contato">Primeiro Contato</option>
                <option value="avaliacao">Avaliação</option>
                <option value="test_drive_agendado">Test Drive Agendado</option>
                <option value="test_drive_realizado">Test Drive Realizado</option>
                <option value="proposta_enviada">Proposta Enviada</option>
                <option value="negociacao_preco">Negociação Preço</option>
                <option value="aprovacao_credito">Aprovação Crédito</option>
                <option value="documentacao">Documentação</option>
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
                type="number"
                id="offered_price"
                value={formData.offered_price}
                onChange={(e) => setFormData({ ...formData, offered_price: e.target.value })}
                step="0.01"
                min="0"
                placeholder="55000.00"
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
