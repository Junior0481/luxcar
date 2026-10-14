import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, CheckCircle, Copy, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';
import { formatPhone } from '../../lib/format';

type Request = { id: string; company_name: string; slug: string; owner_name: string; owner_email: string; phone: string | null; city: string | null; state: string | null; payment_reference: string | null; status: string; created_at: string };
type Payment = { id: string; payment_reference: string | null; amount: number | null; period_start: string; period_end: string; status: string; created_at: string };
type Company = { id: string; name: string; slug: string; email?: string; phone?: string; city?: string; state?: string; status: string; plan: string; created_at: string; subscription_status: string; billing_cycle: string; subscription_started_at: string | null; current_period_end: string | null; grace_ends_at: string | null; cancelled_at: string | null; owner_access_delivered_at: string | null; owner_first_login_at: string | null; onboarding_completed_at: string | null; owner: { email: string; full_name: string } | null; member_count: number; vehicle_count: number; payments: Payment[] };
type Audit = { id: string; event_type: string; details: Record<string, unknown>; created_at: string; company_id: string | null; actor: { email: string; full_name: string } | null };
const dateValue = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : '';
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '—';
const labels: Record<string, string> = { subscription_payment_confirmed: 'Pagamento confirmado', subscription_updated: 'Assinatura atualizada', company_status_changed: 'Status da concessionária alterado', owner_access_marked_delivered: 'Acesso do proprietário entregue', owner_first_login: 'Primeiro acesso do proprietário', onboarding_completed: 'Implantação concluída', owner_recovery_link_generated: 'Link de recuperação gerado' };

export function Platform() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<{ company: string; email: string; password: string } | null>(null);
  const [recovery, setRecovery] = useState<{ company: string; email: string; link: string } | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState('');
  const [payment, setPayment] = useState({ reference: '', amount: '', periodEnd: '' });
  const [subscription, setSubscription] = useState({ status: 'active', cycle: 'monthly', periodEnd: '', graceEnd: '' });
  const selected = companies.find((item) => item.id === selectedId) || null;
  const pending = requests.filter((item) => item.status === 'pending_payment');
  const stats = useMemo(() => ({ active: companies.filter((item) => item.subscription_status === 'active').length, late: companies.filter((item) => item.subscription_status === 'past_due').length, suspended: companies.filter((item) => item.status === 'suspended').length, onboarding: companies.filter((item) => !item.onboarding_completed_at).length }), [companies]);

  async function load() {
    setLoading(true); setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('admin-provision', { body: { action: 'platform_overview' } });
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || 'Erro ao carregar a plataforma.');
    else { setCompanies(data.companies || []); setRequests(data.requests || []); setAudit(data.audit || []); }
    setLoading(false);
  }
  useEffect(() => { if (profile?.role === 'platform_admin') void load(); else if (profile) setLoading(false); }, [profile?.role]);
  useEffect(() => { if (selected) setSubscription({ status: selected.subscription_status, cycle: selected.billing_cycle, periodEnd: dateValue(selected.current_period_end), graceEnd: dateValue(selected.grace_ends_at) }); }, [selectedId, companies]);
  async function act(action: string, args: Record<string, unknown> = {}) {
    setSaving(action); setMessage(''); setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('admin-provision', { body: { action, ...args } });
    setSaving('');
    if (invokeError || data?.error) { setError(data?.error || invokeError?.message || 'Não foi possível concluir a ação.'); return null; }
    return data;
  }
  async function provision(event: FormEvent, request: Request) {
    event.preventDefault(); const password = passwords[request.id] || '';
    if (password.length < 8) { setError('A senha temporária precisa ter pelo menos 8 caracteres.'); return; }
    const data = await act('confirm_payment_and_provision', { requestId: request.id, adminPassword: password });
    if (data) { setMessage('Pagamento confirmado e concessionária provisionada. Copie e envie o acesso ao proprietário.'); setCredentials({ company: request.company_name, email: request.owner_email, password }); setPasswords((current) => ({ ...current, [request.id]: '' })); await load(); }
  }
  async function saveSubscription(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    const data = await act('update_subscription', { companyId: selected.id, subscriptionStatus: subscription.status, billingCycle: subscription.cycle, currentPeriodEnd: subscription.periodEnd ? new Date(`${subscription.periodEnd}T23:59:59`).toISOString() : null, graceEndsAt: subscription.graceEnd ? new Date(`${subscription.graceEnd}T23:59:59`).toISOString() : null });
    if (data) { setMessage('Assinatura atualizada.'); await load(); }
  }
  async function confirmRenewal(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    const data = await act('confirm_renewal_payment', { companyId: selected.id, paymentReference: payment.reference, amount: payment.amount, periodEnd: payment.periodEnd ? new Date(`${payment.periodEnd}T23:59:59`).toISOString() : '' });
    if (data) { setMessage('Renovação registrada e assinatura ativada.'); setPayment({ reference: '', amount: '', periodEnd: '' }); await load(); }
  }
  async function mark(action: string) { if (!selected) return; const data = await act(action, { companyId: selected.id }); if (data) { setMessage('Checklist atualizado.'); await load(); } }
  async function recover() { if (!selected) return; const data = await act('create_owner_recovery_link', { companyId: selected.id }); if (data) setRecovery({ company: data.company, email: data.email, link: data.action_link }); }
  async function changeStatus(status: string) { if (!selected) return; const data = await act('set_company_status', { companyId: selected.id, status }); if (data) { setMessage('Status da concessionária atualizado.'); await load(); } }

  if (profile?.role !== 'platform_admin') return <div className="space-y-6"><PageHeader icon={Building2} eyebrow="Administração do SaaS" title="Plataforma" description="Acesso exclusivo à administração da plataforma." /><EmptyState icon={Building2} title="Acesso restrito" description="Somente administradores da plataforma podem acessar esta área." /></div>;
  if (loading) return <div className="space-y-6"><PageHeader icon={Building2} eyebrow="Administração do SaaS" title="Painel da plataforma" description="Concessionárias, assinaturas e implantação." /><Skeleton className="h-80 w-full" /></div>;

  return <div className="space-y-6">
    <PageHeader icon={Building2} eyebrow="Administração do SaaS" title="Painel da plataforma" description="Acompanhe clientes, pagamentos, implantação e suporte às concessionárias." />
    <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4" />Atualizar painel</Button></div>
    {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="size-5 shrink-0" />{error}</div>}
    {message && <p role="status" className="rounded-xl border border-border bg-muted p-3 text-sm">{message}</p>}
    {credentials && <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="size-5 text-primary" />Acesso inicial · {credentials.company}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Email: <strong>{credentials.email}</strong></p><p>Senha temporária: <strong>{credentials.password}</strong></p><p className="text-muted-foreground">Envie estes dados ao proprietário por canal seguro. A senha só fica visível nesta tela.</p><Button variant="outline" onClick={() => void navigator.clipboard.writeText(`LuxCar — ${credentials.company}\nEmail: ${credentials.email}\nSenha temporária: ${credentials.password}`)}><Copy className="size-4" />Copiar acesso</Button></CardContent></Card>}
    {recovery && <Card className="border-primary/30"><CardHeader><CardTitle>Recuperação de acesso · {recovery.company}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Envie este link de recuperação para <strong>{recovery.email}</strong>. Ele é de uso único e não é salvo no histórico.</p><Input readOnly value={recovery.link} /><Button variant="outline" onClick={() => void navigator.clipboard.writeText(recovery.link)}><Copy className="size-4" />Copiar link</Button></CardContent></Card>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[['Solicitações pendentes', pending.length], ['Assinaturas ativas', stats.active], ['Em atraso', stats.late], ['Concessionárias suspensas', stats.suspended], ['Implantação pendente', stats.onboarding]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>)}</div>

    <Card><CardHeader><CardTitle>Solicitações de assinatura · {pending.length} aguardando pagamento</CardTitle></CardHeader><CardContent>{pending.length === 0 ? <EmptyState icon={Building2} title="Nenhuma solicitação pendente" description="Novas solicitações aparecerão aqui." className="min-h-36 border-0 shadow-none" /> : <div className="space-y-4">{pending.map((request) => <article key={request.id} className="rounded-2xl border p-4"><div className="grid gap-3 sm:grid-cols-2"><div><h3 className="font-semibold">{request.company_name}</h3><p className="text-sm text-muted-foreground">{request.slug} · {request.city || 'Cidade não informada'}{request.state ? `, ${request.state}` : ''}</p></div><div className="text-sm">{request.owner_name}<p className="text-muted-foreground">{request.owner_email}{request.phone ? ` · ${formatPhone(request.phone)}` : ''}</p></div><p className="sm:col-span-2 rounded-xl bg-muted/50 p-3 text-sm"><strong>Referência:</strong> {request.payment_reference || 'Não informada'}<span className="block text-xs text-muted-foreground">Recebido em {dateLabel(request.created_at)}</span></p></div><form onSubmit={(event) => void provision(event, request)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1 space-y-2"><Label htmlFor={`password-${request.id}`}>Senha temporária do proprietário</Label><Input id={`password-${request.id}`} type="password" minLength={8} autoComplete="new-password" required value={passwords[request.id] || ''} onChange={(event) => setPasswords({ ...passwords, [request.id]: event.target.value })} /></div><Button type="submit" disabled={saving === 'confirm_payment_and_provision'}>{saving === 'confirm_payment_and_provision' ? 'Provisionando…' : 'Confirmar pagamento e provisionar'}</Button></form></article>)}</div>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Concessionárias e ficha operacional</CardTitle></CardHeader><CardContent className="space-y-4"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Selecione uma concessionária</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.owner?.email || 'sem proprietário'}</option>)}</select>
      {!selected ? <EmptyState icon={Building2} title="Selecione uma concessionária" description="A ficha mostra proprietário, equipe, estoque, pagamentos, implantação e auditoria." className="min-h-32 border-0 shadow-none" /> : <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Proprietário</p><p className="font-medium">{selected.owner?.full_name || '—'}</p><p className="text-sm text-muted-foreground">{selected.owner?.email || selected.email || '—'}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Operação</p><p>{selected.member_count} usuários · {selected.vehicle_count} veículos</p><p className="text-sm text-muted-foreground">{selected.city || '—'}{selected.state ? `, ${selected.state}` : ''}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Assinatura</p><p className="capitalize">{selected.subscription_status} · {selected.billing_cycle === 'annual' ? 'anual' : 'mensal'}</p><p className="text-sm text-muted-foreground">Renova: {dateLabel(selected.current_period_end)}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Conta</p><p className="capitalize">{selected.status}</p><p className="text-sm text-muted-foreground">Plano completo · criada {dateLabel(selected.subscription_started_at || selected.created_at)}</p></div></div>

        <div className="grid gap-5 xl:grid-cols-2"><Card><CardHeader><CardTitle>Ciclo e estado da assinatura</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={(event) => void saveSubscription(event)}><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Status</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={subscription.status} onChange={(event) => setSubscription({ ...subscription, status: event.target.value })}><option value="active">Ativa</option><option value="past_due">Em atraso</option><option value="cancelled">Cancelada</option></select></div><div className="space-y-2"><Label>Ciclo</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={subscription.cycle} onChange={(event) => setSubscription({ ...subscription, cycle: event.target.value })}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></div><div className="space-y-2"><Label>Renovação</Label><Input type="date" value={subscription.periodEnd} onChange={(event) => setSubscription({ ...subscription, periodEnd: event.target.value })} /></div><div className="space-y-2"><Label>Fim da tolerância</Label><Input type="date" value={subscription.graceEnd} onChange={(event) => setSubscription({ ...subscription, graceEnd: event.target.value })} /></div></div><div className="flex flex-wrap gap-2"><Button type="submit" disabled={!!saving}>Salvar assinatura</Button><Button type="button" variant="outline" onClick={() => void changeStatus(selected.status === 'suspended' ? 'active' : 'suspended')} disabled={!!saving}>{selected.status === 'suspended' ? 'Reativar concessionária' : 'Suspender concessionária'}</Button></div></form></CardContent></Card>
        <Card><CardHeader><CardTitle>Registrar renovação recebida</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={(event) => void confirmRenewal(event)}><div className="space-y-2"><Label>Referência do pagamento</Label><Input required value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} placeholder="ID da transação ou observação" /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Valor (opcional)</Label><Input type="number" min="0" step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></div><div className="space-y-2"><Label>Nova data de renovação</Label><Input type="date" required value={payment.periodEnd} onChange={(event) => setPayment({ ...payment, periodEnd: event.target.value })} /></div></div><Button type="submit" disabled={!!saving}>Confirmar renovação</Button></form></CardContent></Card></div>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="size-5" />Checklist de implantação</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm">Acesso entregue: <strong>{selected.owner_access_delivered_at ? `Sim · ${dateLabel(selected.owner_access_delivered_at)}` : 'Pendente'}</strong></p><p className="text-sm">Primeiro login do proprietário: <strong>{selected.owner_first_login_at ? dateLabel(selected.owner_first_login_at) : 'Aguardando login'}</strong></p><p className="text-sm">Implantação: <strong>{selected.onboarding_completed_at ? `Concluída · ${dateLabel(selected.onboarding_completed_at)}` : 'Em andamento'}</strong></p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void mark('mark_owner_access_delivered')} disabled={!!selected.owner_access_delivered_at || !!saving}>Marcar acesso como entregue</Button><Button onClick={() => void mark('mark_onboarding_ready')} disabled={!selected.owner_access_delivered_at || !selected.owner_first_login_at || !!selected.onboarding_completed_at || !!saving}>Concluir implantação</Button></div></CardContent></Card>

        <div className="grid gap-5 xl:grid-cols-2"><Card><CardHeader><CardTitle>Pagamentos registrados</CardTitle></CardHeader><CardContent>{selected.payments.length ? <div className="divide-y">{selected.payments.map((item) => <div key={item.id} className="py-3 text-sm"><div className="flex justify-between gap-3"><strong>{item.payment_reference || 'Pagamento confirmado'}</strong><span>{item.amount == null ? 'Valor não informado' : item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div><p className="text-muted-foreground">Período até {dateLabel(item.period_end)} · {dateLabel(item.created_at)}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />Suporte seguro ao proprietário</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Gere um link de recuperação para o email cadastrado. A ação fica registrada na auditoria; o link não é armazenado.</p><Button variant="outline" onClick={() => void recover()} disabled={!!saving}>Gerar link de recuperação</Button></CardContent></Card></div>
        <Card><CardHeader><CardTitle>Histórico de auditoria · {selected.name}</CardTitle></CardHeader><CardContent>{audit.filter((entry) => entry.company_id === selected.id).length ? <div className="divide-y">{audit.filter((entry) => entry.company_id === selected.id).map((entry) => <div key={entry.id} className="py-3 text-sm"><p className="font-medium">{labels[entry.event_type] || entry.event_type}</p><p className="text-muted-foreground">{entry.actor?.full_name || entry.actor?.email || 'Sistema'} · {dateLabel(entry.created_at)}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma atividade administrativa registrada.</p>}</CardContent></Card>
      </div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Auditoria recente da plataforma</CardTitle></CardHeader><CardContent>{audit.length ? <div className="divide-y">{audit.slice(0, 20).map((entry) => <div key={entry.id} className="flex flex-col justify-between gap-1 py-3 text-sm sm:flex-row"><span><strong>{labels[entry.event_type] || entry.event_type}</strong>{entry.company_id ? ` · ${companies.find((item) => item.id === entry.company_id)?.name || 'Concessionária'}` : ''}<span className="block text-muted-foreground">{entry.actor?.full_name || entry.actor?.email || 'Sistema'}</span></span><span className="text-muted-foreground">{dateLabel(entry.created_at)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">As ações administrativas aparecerão aqui.</p>}</CardContent></Card>
  </div>;
}
