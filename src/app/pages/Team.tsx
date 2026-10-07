import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Profile, supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';

export function Team() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'vendedor' });

  async function loadMembers() {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('full_name');

      if (err) throw err;
      setMembers(data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar colaboradores da empresa.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMembers(); }, [profile?.company_id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const { data, error } = await supabase.functions.invoke('admin-provision', {
      body: { action: 'create_member', ...form }
    });
    setSaving(false);
    if (error || data?.error) return setMessage(data?.error || error?.message || 'Não foi possível criar o acesso.');
    setForm({ fullName: '', email: '', password: '', role: 'vendedor' });
    setMessage('Acesso criado com sucesso.');
    await loadMembers();
  }

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
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="member-name">Nome completo</Label><Input id="member-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="member-password">Senha inicial</Label><Input id="member-password" type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="member-role">Perfil</Label><select id="member-role" className="h-10 w-full rounded-lg border border-input bg-input-background px-3" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="vendedor">Vendedor</option><option value="administrador">Administrador</option></select></div>
            <Button disabled={saving} type="submit" className="md:col-span-2">{saving ? 'Criando...' : 'Criar acesso'}</Button>
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
            <div className="divide-y divide-border">
              {members.map((member) => (
                <div key={member.id} className="flex justify-between py-3">
                  <span>
                    {member.full_name}
                    <small className="block text-muted-foreground">{member.email}</small>
                  </span>
                  <span className="capitalize">{member.role}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
