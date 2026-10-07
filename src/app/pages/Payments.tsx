import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, CreditCard, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Negotiation, Payment, supabase } from '../../lib/supabase';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';

type PaymentRow = Payment & { negotiation?: Pick<Negotiation, 'client_name'> };

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL'
}).format(value);

export function Payments() {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ negotiationId: '', amount: '', method: 'pix' as Payment['method'] });
  const isAdmin = profile?.role === 'administrador';

  async function load() {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [paymentResult, negotiationResult] = await Promise.all([
        supabase.from('payments').select('*, negotiation:negotiations(client_name)').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
        supabase.from('negotiations').select('*').eq('company_id', profile.company_id).not('stage', 'in', '(finalizado,perdido)')
      ]);

      if (paymentResult.error) {
        throw new Error(paymentResult.error.code === '42P01' ? 'Execute a migração white label para habilitar pagamentos.' : paymentResult.error.message);
      }
      if (negotiationResult.error) {
        throw negotiationResult.error;
      }

      setPayments((paymentResult.data as PaymentRow[]) || []);
      setNegotiations(negotiationResult.data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pagamentos.');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={CreditCard} eyebrow="Financeiro" title="Pagamentos" description="Registre recebimentos vinculados às negociações da loja." />
        <Skeleton className="h-56 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={CreditCard} eyebrow="Financeiro" title="Pagamentos" description="Registre recebimentos vinculados às negociações da loja." />

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar pagamentos</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()} className="w-fit">
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

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

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum pagamento registrado"
          description="Registre o primeiro recebimento usando o formulário acima para acompanhar o status financeiro das negociações."
        />
      ) : (
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
      )}
    </div>
  );
}
