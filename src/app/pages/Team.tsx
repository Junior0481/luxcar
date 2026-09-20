import { FormEvent, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Profile, supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/ui/page-header';

export function Team() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'vendedor' });

  async function loadMembers() {
    if (!profile?.company_id) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('company_id', profile.company_id).order('full_name');
    if (error) setMessage(error.message);
    else setMembers(data || []);
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

  if (profile?.role !== 'administrador') return <p role="alert">Apenas administradores podem gerenciar a equipe.</p>;

  return <div className="space-y-6">
    <PageHeader icon={Users} eyebrow="Acessos da empresa" title="Equipe" description="Cadastre administradores e vendedores da sua loja." />
    {message && <p role="status" aria-live="polite" className="rounded-xl border p-3">{message}</p>}
    <Card><CardHeader><CardTitle>Novo acesso</CardTitle></CardHeader><CardContent>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="member-name">Nome completo</Label><Input id="member-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="member-password">Senha inicial</Label><Input id="member-password" type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="member-role">Perfil</Label><select id="member-role" className="h-10 w-full rounded-lg border bg-background px-3" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="vendedor">Vendedor</option><option value="administrador">Administrador</option></select></div>
        <Button disabled={saving} type="submit" className="md:col-span-2">{saving ? 'Criando...' : 'Criar acesso'}</Button>
      </form>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Usuários da empresa</CardTitle></CardHeader><CardContent className="divide-y">
      {members.map((member) => <div key={member.id} className="flex justify-between py-3"><span>{member.full_name}<small className="block text-muted-foreground">{member.email}</small></span><span className="capitalize">{member.role}</span></div>)}
    </CardContent></Card>
  </div>;
}
