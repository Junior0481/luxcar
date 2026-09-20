import { FormEvent, useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Negotiation, Payment, supabase } from '../../lib/supabase';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/ui/page-header';

type PaymentRow = Payment & { negotiation?: Pick<Negotiation, 'client_name'> };

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL'
}).format(value);

export function Payments() {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ negotiationId: '', amount: '', method: 'pix' as Payment['method'] });
  const isAdmin = profile?.role === 'administrador';

  async function load() {
    if (!profile?.company_id) return;
    const [paymentResult, negotiationResult] = await Promise.all([
      supabase.from('payments').select('*, negotiation:negotiations(client_name)').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
      supabase.from('negotiations').select('*').eq('company_id', profile.company_id).not('stage', 'in', '(finalizado,perdido)')
    ]);
    if (paymentResult.error) {
      setMessage(paymentResult.error.code === '42P01' ? 'Execute a migração white label para habilitar pagamentos.' : paymentResult.error.message);
      return;
    }
    setPayments((paymentResult.data as PaymentRow[]) || []);
    setNegotiations(negotiationResult.data || []);
  }

  useEffect(() => { load(); }, [profile?.company_id]);

  async function createPayment(event: FormEvent) {
    event.preventDefault();
    if (!profile?.company_id || !user) return;
    const { error } = await supabase.from('payments').insert({
      company_id: profile.company_id,
      negotiation_id: form.negotiationId,
      amount: Number(form.amount),
      method: form.method,
      created_by: user.id
    });
    setMessage(error ? error.message : 'Pagamento registrado.');
    if (!error) {
      setForm({ negotiationId: '', amount: '', method: 'pix' });
      await load();
    }
  }

  async function updateStatus(id: string, status: Payment['status']) {
    const { error } = await supabase.rpc('set_payment_status', { payment_id: id, next_status: status });
    setMessage(error ? error.message : 'Status do pagamento atualizado.');
    if (!error) await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={CreditCard} eyebrow="Financeiro" title="Pagamentos" description="Registre recebimentos vinculados às negociações da loja." />
      {message ? <p role="status" aria-live="polite" className="rounded-xl border border-border bg-muted p-3 text-sm">{message}</p> : null}

      <Card>
        <CardHeader><CardTitle>Novo pagamento</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createPayment} className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payment-negotiation">Negociação</Label>
              <select id="payment-negotiation" required value={form.negotiationId} onChange={(e) => setForm({ ...form, negotiationId: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-input-background px-3">
                <option value="">Selecione</option>
                {negotiations.map((item) => <option key={item.id} value={item.id}>{item.client_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Valor</Label>
              <Input id="payment-amount" required min="0.01" step="0.01" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method">Forma</Label>
              <select id="payment-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as Payment['method'] })} className="h-10 w-full rounded-lg border border-input bg-input-background px-3">
                <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="financiamento">Financiamento</option><option value="transferencia">Transferência</option><option value="outro">Outro</option>
              </select>
            </div>
            <Button type="submit" className="md:col-span-4 md:w-fit">Registrar pagamento</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {payments.map((payment) => (
          <Card key={payment.id}>
            <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div><p className="font-medium">{payment.negotiation?.client_name || 'Negociação'}</p><p className="text-sm text-muted-foreground">{money(payment.amount)} · {payment.method}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={payment.status === 'paid' ? 'default' : payment.status === 'cancelled' ? 'destructive' : 'secondary'}>{payment.status}</Badge>
                {isAdmin && payment.status === 'pending' ? <Button size="sm" onClick={() => updateStatus(payment.id, 'authorized')}>Autorizar</Button> : null}
                {isAdmin && ['pending', 'authorized'].includes(payment.status) ? <Button size="sm" onClick={() => updateStatus(payment.id, 'paid')}>Marcar como pago</Button> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
