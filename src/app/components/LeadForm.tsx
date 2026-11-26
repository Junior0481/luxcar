import { useEffect, useRef, useState } from 'react';
import { createLead } from '../../services/leads.service';
import { AlertCircle, CheckCircle } from 'lucide-react';
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

type LeadFormProps = {
  open?: boolean;
  vehicleId: string;
  companyId: string;
  vehicleName: string;
  onClose: () => void;
};

const initialFormData = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  message: '',
  website: ''
};

export function LeadForm({ open = true, vehicleId, companyId, vehicleName, onClose }: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setError('');
      setSuccess(false);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      errorRef.current.focus();
    }
  }, [error]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, [success, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.customer_email.trim() && !formData.customer_phone.trim()) {
      setError('Informe e-mail ou telefone para contato.');
      return;
    }
    setLoading(true);

    try {
      await createLead({
        company_id: companyId,
        vehicle_id: vehicleId,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        message: formData.message,
        website: formData.website,
      });

      setSuccess(true);
    } catch (err: any) {
      let message = err.message || 'Erro ao enviar mensagem';
      const functionError = err.cause ?? err;
      if (functionError.context instanceof Response) {
        const body = await functionError.context.json().catch(() => null);
        message = body?.error || message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !loading) onClose(); }}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(e) => { if (loading) e.preventDefault(); }}
        onInteractOutside={(e) => { if (loading) e.preventDefault(); }}
      >
        <DialogHeader className="pr-6">
          <DialogTitle className="text-xl font-bold text-foreground">Tenho Interesse</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{vehicleName}</DialogDescription>
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

        {success && (
          <div role="status" aria-live="polite" className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">Mensagem enviada com sucesso! Em breve entraremos em contato.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer_name">Seu Nome *</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
              placeholder="João Silva"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_email">Email</Label>
            <Input
              type="email"
              id="customer_email"
              value={formData.customer_email}
              onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_phone">Telefone</Label>
            <Input
              type="tel"
              id="customer_phone"
              value={formData.customer_phone}
              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem (opcional)</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              placeholder="Gostaria de mais informações sobre este veículo..."
            />
          </div>

          {/* Campo isca: invisível para pessoas, robôs costumam preencher. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-px w-px opacity-0"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || success} className="flex-1">
              {loading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
