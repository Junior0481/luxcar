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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

type PaymentRow = Payment & { negotiation?: Pick<Negotiation, 'client_name'> };

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL'
}).format(value);

const parsePaymentAmount = (rawValue: string): number | null => {
  let value = rawValue.trim().replace(/[R$\s]/g, '');
  if (!value) return null;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    value = lastComma > lastDot
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(/,/g, '');
  } else if (lastComma >= 0) {
    value = value.replace(',', '.');
  } else if (/\.\d{3}$/.test(value)) {
    value = value.replace(/\./g, '');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

export function Payments() {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ negotiationId: '', amount: '', method: 'pix' as Payment['method'] });
  const isAdmin = profile?.role === 'administrador';
  const selectedNegotiation = negotiations.find((item) => item.id === form.negotiationId);
  const registeredForNegotiation = payments
    .filter((payment) => payment.negotiation_id === form.negotiationId && ['pending', 'authorized', 'paid'].includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const proposedAmount = Number(selectedNegotiation?.offered_price || 0);
  const remainingAmount = proposedAmount > 0 ? Math.max(0, proposedAmount - registeredForNegotiation) : null;
  const enteredAmount = parsePaymentAmount(form.amount);
  const amountExceedsProposal = remainingAmount !== null && enteredAmount !== null && enteredAmount > remainingAmount + 0.001;

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
    const amount = parsePaymentAmount(form.amount);
    if (amount === null || amount <= 0) {
      setMessage('Digite um valor válido maior que zero.');
      return;
    }
    const negotiation = negotiations.find((item) => item.id === form.negotiationId);
    const currentTotal = payments
      .filter((payment) => payment.negotiation_id === form.negotiationId && ['pending', 'authorized', 'paid'].includes(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const proposedTotal = Number(negotiation?.offered_price || 0);
    if (proposedTotal > 0 && currentTotal + amount > proposedTotal + 0.001) {
      const available = Math.max(0, proposedTotal - currentTotal);
      setMessage(`O pagamento ultrapassa o valor proposto de ${money(proposedTotal)}. Saldo disponível para registrar: ${money(available)}.`);
      return;
    }
    const { error } = await supabase.from('payments').insert({
      company_id: profile.company_id,
      negotiation_id: form.negotiationId,
      amount,
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

      <section aria-label="Resumo dos pagamentos" className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card">
        {[
          { label: 'Total registrado', value: money(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)) },
          { label: 'Aguardando', value: money(payments.filter((payment) => ['pending', 'authorized'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)) },
          { label: 'Pagos', value: money(payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount || 0), 0)) },
        ].map((item) => <div key={item.label} className="border-r border-border px-4 py-3 last:border-r-0 sm:px-5"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums [font-family:var(--font-display)]">{item.value}</p></div>)}
      </section>

      <Card>
        <CardHeader><CardTitle>Novo pagamento</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createPayment} className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payment-negotiation">Negociação</Label>
              <select id="payment-negotiation" required value={form.negotiationId} onChange={(e) => setForm({ ...form, negotiationId: e.target.value })} className="h-10 w-full rounded-lg border border-input bg-input-background px-3">
                <option value="">Selecione</option>
                {negotiations.map((item) => <option key={item.id} value={item.id}>{item.client_name} · {item.vehicle_id ? 'Veículo vinculado' : 'Sem veículo'}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Valor</Label>
              <Input id="payment-amount" required inputMode="decimal" type="text" placeholder="200.000,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} aria-describedby={remainingAmount !== null ? 'payment-balance-hint' : undefined} />
              {remainingAmount !== null ? <p id="payment-balance-hint" className="text-xs text-muted-foreground">Proposta: {money(proposedAmount)} · Já registrado: {money(registeredForNegotiation)} · Saldo: {money(remainingAmount)}</p> : null}
              {amountExceedsProposal ? <p role="alert" className="text-xs font-medium text-destructive">Esse valor ultrapassa o saldo disponível da proposta ({money(remainingAmount!)}).</p> : null}
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

      {!error && payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum pagamento registrado"
          description="Registre o primeiro recebimento para acompanhar o status financeiro das negociações."
        />
      ) : null}

      {payments.length > 0 && <Table className="min-w-[680px]"><TableHeader><TableRow><TableHead>Negociação</TableHead><TableHead>Forma</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{payments.map((payment) => <TableRow key={payment.id}>
        <TableCell className="font-medium">{payment.negotiation?.client_name || 'Negociação'}</TableCell><TableCell className="capitalize">{payment.method}</TableCell><TableCell className="text-muted-foreground">{new Date(payment.created_at).toLocaleDateString('pt-BR')}</TableCell><TableCell className="text-right font-semibold tabular-nums">{money(payment.amount)}</TableCell><TableCell><Badge variant={payment.status === 'paid' ? 'default' : payment.status === 'cancelled' ? 'destructive' : 'secondary'}>{payment.status}</Badge></TableCell><TableCell><div className="flex justify-end gap-2">{isAdmin && payment.status === 'pending' ? <Button size="sm" variant="secondary" onClick={() => updateStatus(payment.id, 'authorized')}>Autorizar</Button> : null}{isAdmin && ['pending', 'authorized'].includes(payment.status) ? <Button size="sm" onClick={() => updateStatus(payment.id, 'paid')}>Marcar pago</Button> : null}</div></TableCell>
      </TableRow>)}</TableBody></Table>}
    </div>
  );
}
