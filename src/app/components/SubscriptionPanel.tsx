import { useEffect, useState } from 'react';
import { CreditCard, LoaderCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  countCompanyVehicles,
  createRenewalCharge,
  getCompanyPlan,
  getCompanySubscription,
  listSubscriptionPayments,
  subscriptionNotice,
  type CompanySubscription,
  type Plan,
  type SubscriptionPayment,
  type TenantContext
} from '../../services';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

const currency = (value: number | null | undefined) => value == null ? '—' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
const statusLabel: Record<string, string> = { active: 'Ativa', past_due: 'Em atraso', blocked: 'Bloqueada', cancelled: 'Cancelada' };

type Usage = { vehicles: number; administrators: number; sellers: number };

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-muted-foreground">{used}/{limit}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
        <div className={`h-full rounded-full ${percent >= 100 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function SubscriptionPanel({ ctx }: { ctx: TenantContext }) {
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const paymentConfirmed = new URLSearchParams(window.location.search).get('pagamento') === 'confirmado';

  useEffect(() => {
    if (!ctx.companyId) return;
    let active = true;
    (async () => {
      try {
        const [loadedSubscription, loadedPlan, vehicles, team, history] = await Promise.all([
          getCompanySubscription(),
          getCompanyPlan(ctx),
          countCompanyVehicles(ctx),
          supabase.from('profiles').select('role').eq('company_id', ctx.companyId!),
          listSubscriptionPayments(ctx.companyId!)
        ]);
        if (!active) return;
        const members = team.data || [];
        setSubscription(loadedSubscription);
        setPlan(loadedPlan);
        setUsage({
          vehicles,
          administrators: members.filter((member) => member.role === 'administrador').length,
          sellers: members.filter((member) => member.role === 'vendedor').length
        });
        setPayments(history);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a assinatura.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [ctx.companyId]);

  const pay = async () => {
    setPaying(true);
    setError('');
    try {
      const charge = await createRenewalCharge();
      window.location.href = charge.url;
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : 'Não foi possível gerar a cobrança.');
      setPaying(false);
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!subscription || !plan) return <p className="text-sm text-muted-foreground">{error || 'Assinatura não encontrada.'}</p>;

  const amount = subscription.billing_cycle === 'annual' ? plan.annual_price : plan.monthly_price;
  const notice = subscriptionNotice(subscription);

  return (
    <div className="space-y-6">
      {paymentConfirmed && <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">Pagamento enviado. Assim que a AbacatePay confirmar, o novo vencimento aparece aqui.</p>}
      {notice?.kind === 'due_today' && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Sua assinatura vence hoje.</p>}
      {notice?.kind === 'grace' && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Pagamento em atraso: {notice.daysLeft === 1 ? 'resta 1 dia' : `restam ${notice.daysLeft} dias`} para regularizar antes do bloqueio.</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Plano', plan.name],
          ['Ciclo', subscription.billing_cycle === 'annual' ? 'Anual' : 'Mensal'],
          ['Valor', currency(amount)],
          ['Próximo vencimento', date(subscription.current_period_end)],
          ['Status', statusLabel[subscription.subscription_status] || subscription.subscription_status]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void pay()} disabled={paying || subscription.subscription_status === 'cancelled'}>
          {paying ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <CreditCard className="mr-2 size-4" />}
          Pagar {currency(amount)}
        </Button>
        <p className="text-sm text-muted-foreground">O pagamento renova a assinatura no mesmo dia do vencimento atual.</p>
      </div>

      {usage && (
        <section className="space-y-3" aria-labelledby="plan-usage-heading">
          <h3 id="plan-usage-heading" className="font-medium">Uso do plano</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <UsageBar label="Carros" used={usage.vehicles} limit={plan.max_vehicles} />
            <UsageBar label="Vendedores" used={usage.sellers} limit={plan.max_sellers} />
            <UsageBar label="Administradores" used={usage.administrators} limit={plan.max_administrators} />
          </div>
          {plan.id !== 'platinum' && <p className="text-sm text-muted-foreground">Precisa de mais carros, equipe ou relatórios? Fale com a equipe LuxCar para mudar de plano.</p>}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="payment-history-heading">
        <h3 id="payment-history-heading" className="font-medium">Histórico de pagamentos</h3>
        {payments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="p-3 font-medium">Período</th><th className="p-3 font-medium">Valor</th><th className="p-3 font-medium">Confirmado em</th></tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t">
                    <td className="p-3">{date(payment.period_start)} – {date(payment.period_end)}</td>
                    <td className="p-3 tabular-nums">{currency(payment.amount)}</td>
                    <td className="p-3">{date(payment.confirmed_at || payment.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
