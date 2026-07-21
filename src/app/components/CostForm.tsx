import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

type CostFormProps = {
  vehicleId: string;
  onClose: () => void;
};

const selectClass =
  'w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export function CostForm({ vehicleId, onClose }: CostFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    cost_type: 'manutencao' as 'manutencao' | 'estetica' | 'mecanica' | 'revisao' | 'laudo' | 'outro',
    description: '',
    amount: '',
    service_date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.from('vehicle_costs').insert([
        {
          vehicle_id: vehicleId,
          cost_type: formData.cost_type,
          description: formData.description,
          amount: parseFloat(formData.amount),
          service_date: formData.service_date,
          created_by: user?.id
        }
      ]);

      if (error) throw error;
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar custo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Adicionar Custo/Manutenção</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cost_type">Tipo de Custo *</Label>
            <select
              id="cost_type"
              value={formData.cost_type}
              onChange={(e) => setFormData({ ...formData, cost_type: e.target.value as any })}
              className={selectClass}
            >
              <option value="manutencao">Manutenção</option>
              <option value="estetica">Estética</option>
              <option value="mecanica">Mecânica</option>
              <option value="revisao">Revisão</option>
              <option value="laudo">Laudo</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={3}
              placeholder="Descreva o serviço realizado..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$) *</Label>
            <Input
              type="number"
              id="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              step="0.01"
              min="0"
              placeholder="150.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service_date">Data do Serviço</Label>
            <Input
              type="date"
              id="service_date"
              value={formData.service_date}
              onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
