import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../lib/supabase';
import { createTeamMember, getCompanyPlan, listTeamMembers, tenantContextFromProfile } from '../../services';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

type PlanLimits = { max_administrators: number; max_sellers: number };

export function Team() {
  const { user, profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [form, setForm] = useState<{ fullName: string; email: string; password: string; role: 'vendedor' | 'administrador' }>({ fullName: '', email: '', password: '', role: 'vendedor' });

  async function loadMembers() {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ctx = tenantContextFromProfile(user?.id, profile);
      const [team, plan] = await Promise.all([listTeamMembers(ctx), getCompanyPlan(ctx)]);
      setMembers(team);
      setPlanLimits(plan);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar colaboradores da empresa.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMembers(); }, [profile?.company_id, user?.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!planLimits || (form.role === 'administrador' ? adminCount >= planLimits.max_administrators : sellerCount >= planLimits.max_sellers)) {
      setMessage(`O plano atingiu o limite de ${form.role === 'administrador' ? 'administradores' : 'vendedores'}.`);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await createTeamMember(form);
      setForm({ fullName: '', email: '', password: '', role: 'vendedor' });
      setMessage('Acesso criado com sucesso.');
      await loadMembers();
    } catch (error: any) {
      setMessage(error.message || 'Não foi possível criar o acesso.');
    } finally {
      setSaving(false);
    }
  }

  const adminCount = members.filter((member) => member.role === 'administrador').length;
  const sellerCount = members.filter((member) => member.role === 'vendedor').length;
  const roleLimitReached = !planLimits || (form.role === 'administrador' ? adminCount >= planLimits.max_administrators : sellerCount >= planLimits.max_sellers);

  if (profile?.role !== 'administrador') {
    return (
      <div className="space-y-6">
        <PageHeader icon={Users} eyebrow="Acessos da empresa" title="Equipe" description="Cadastre administradores e vendedores da sua loja." />
        <EmptyState
          icon={Users}
          title="Acesso restrito à administração"
          description="Apenas administradores da loja têm permissão para gerenciar a equipe de colaboradores."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Users} eyebrow="Acessos da empresa" title="Equipe" description="Cadastre administradores e vendedores da sua loja." />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Users} eyebrow="Acessos da empresa" title="Equipe" description="Cadastre administradores e vendedores da sua loja." />

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar equipe</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadMembers()} className="w-fit">
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {message ? <p role="status" aria-live="polite" className="rounded-xl border border-border bg-muted p-3 text-sm">{message}</p> : null}

      <Card>
        <CardHeader><CardTitle>Novo acesso</CardTitle></CardHeader>
        <CardContent>
          {planLimits && <p className="mb-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Administradores: {adminCount}/{planLimits.max_administrators} · Vendedores: {sellerCount}/{planLimits.max_sellers}</p>}
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="member-name">Nome completo</Label><Input id="member-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="member-password">Senha inicial</Label><Input id="member-password" type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="member-role">Perfil</Label><select id="member-role" className="h-10 w-full rounded-lg border border-input bg-input-background px-3" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'vendedor' | 'administrador' })}><option value="vendedor" disabled={!!planLimits && sellerCount >= planLimits.max_sellers}>Vendedor</option><option value="administrador" disabled={!!planLimits && adminCount >= planLimits.max_administrators}>Administrador</option></select></div>
            <Button disabled={saving || roleLimitReached} type="submit" className="md:col-span-2">{saving ? 'Criando...' : roleLimitReached ? 'Limite do plano atingido' : 'Criar acesso'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usuários da empresa</CardTitle></CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum usuário cadastrado"
              description="Cadastre o primeiro colaborador da sua loja utilizando o formulário acima."
              className="min-h-40 border-0 shadow-none"
            />
          ) : (
            <Table className="min-w-[520px]"><TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Email</TableHead><TableHead>Perfil</TableHead><TableHead>Desde</TableHead></TableRow></TableHeader><TableBody>{members.map((member) => <TableRow key={member.id}><TableCell className="font-medium">{member.full_name}</TableCell><TableCell className="text-muted-foreground">{member.email}</TableCell><TableCell><span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold capitalize">{member.role.replace(/_/g, ' ')}</span></TableCell><TableCell className="text-muted-foreground">{new Date(member.created_at).toLocaleDateString('pt-BR')}</TableCell></TableRow>)}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
