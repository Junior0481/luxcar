import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

type InteractionFormProps = {
  negotiationId: string;
  vehicleId: string;
  onClose: () => void;
};

const selectClass =
  'w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export function InteractionForm({ negotiationId, vehicleId, onClose }: InteractionFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    interaction_type: 'ligacao' as 'ligacao' | 'whatsapp' | 'email' | 'visita' | 'test_drive' | 'proposta' | 'observacao' | 'outro',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.from('interaction_history').insert([
        {
          negotiation_id: negotiationId,
          vehicle_id: vehicleId,
          user_id: user?.id,
          interaction_type: formData.interaction_type,
          description: formData.description
        }
      ]);

      if (error) throw error;
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar interação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Nova Interação</h2>
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
            <Label htmlFor="interaction_type">Tipo de Interação *</Label>
            <select
              id="interaction_type"
              value={formData.interaction_type}
              onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value as any })}
              className={selectClass}
            >
              <option value="ligacao">Ligação</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="visita">Visita</option>
              <option value="test_drive">Test Drive</option>
              <option value="proposta">Proposta</option>
              <option value="observacao">Observação</option>
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
              rows={4}
              placeholder="Descreva o que foi discutido ou combinado..."
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
