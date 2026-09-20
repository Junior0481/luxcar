import { FormEvent, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Company, supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/ui/page-header';

const initialForm = { name: '', slug: '', email: '', phone: '', city: '', state: '', primaryColor: '#f8a746', secondaryColor: '#111827', adminName: '', adminEmail: '', adminPassword: '' };

export function Platform() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    if (error) setMessage(error.message); else setCompanies(data || []);
  }
  useEffect(() => { if (profile?.role === 'platform_admin') load(); }, [profile?.role]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    const { data, error } = await supabase.functions.invoke('admin-provision', { body: { action: 'create_company', ...form } });
    setSaving(false);
    if (error || data?.error) return setMessage(data?.error || error?.message || 'Não foi possível criar a empresa.');
    setMessage('Empresa e administrador criados com sucesso.'); setForm(initialForm); await load();
  }

  if (profile?.role !== 'platform_admin') return <p role="alert">Acesso exclusivo da administração da plataforma.</p>;
  const field = (id: keyof typeof form, label: string, type = 'text') => <div className="space-y-2"><Label htmlFor={`company-${id}`}>{label}</Label><Input id={`company-${id}`} type={type} required={['name','slug','adminName','adminEmail','adminPassword'].includes(id)} value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })} /></div>;

  return <div className="space-y-6">
    <PageHeader icon={Building2} eyebrow="Administração do SaaS" title="Empresas" description="Provisione uma nova operação white label e seu primeiro administrador." />
    {message && <p role="status" aria-live="polite" className="rounded-xl border p-3">{message}</p>}
    <Card><CardHeader><CardTitle>Nova empresa</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {field('name','Nome da empresa')}{field('slug','Identificador (slug)')}{field('email','Email comercial','email')}{field('phone','Telefone')}{field('city','Cidade')}{field('state','Estado')}{field('primaryColor','Cor principal','color')}{field('secondaryColor','Cor secundária','color')}{field('adminName','Nome do administrador')}{field('adminEmail','Email do administrador','email')}{field('adminPassword','Senha inicial','password')}
      <Button disabled={saving} type="submit" className="md:col-span-2 lg:col-span-3">{saving ? 'Provisionando...' : 'Criar empresa e administrador'}</Button>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Empresas cadastradas</CardTitle></CardHeader><CardContent className="divide-y">{companies.map((company) => <div key={company.id} className="flex justify-between py-3"><span>{company.name}<small className="block text-muted-foreground">{company.slug}</small></span><span className="capitalize">{company.status}</span></div>)}</CardContent></Card>
  </div>;
}
