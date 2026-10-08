import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, Building2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Company, supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';

const initialForm = { name: '', slug: '', email: '', phone: '', city: '', state: '', primaryColor: '#f8a746', secondaryColor: '#111827', adminName: '', adminEmail: '', adminPassword: '' };

export function Platform() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function load({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const { data, error: err } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
      if (err) throw err;
      setCompanies(data || []);
    } catch (err: any) {
      const text = err.message || 'Erro ao carregar empresas da plataforma.';
      if (silent) {
        setMessage(`Empresa criada, mas não foi possível atualizar a lista: ${text}`);
      } else {
        setError(text);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (profile?.role === 'platform_admin') {
      load();
    } else if (profile) {
      setLoading(false);
    }
  }, [profile?.role]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const { data, error: err } = await supabase.functions.invoke('admin-provision', { body: { action: 'create_company', ...form } });
    setSaving(false);
    if (err || data?.error) return setMessage(data?.error || err?.message || 'Não foi possível criar a empresa.');
    setMessage('Empresa e administrador criados com sucesso.');
    setForm(initialForm);
    await load({ silent: true });
  }

  if (profile?.role !== 'platform_admin') {
    return (
      <div className="space-y-6">
        <PageHeader icon={Building2} eyebrow="Administração do SaaS" title="Empresas" description="Provisione uma nova operação white label e seu primeiro administrador." />
        <EmptyState
          icon={Building2}
          title="Acesso restrito à plataforma"
          description="Acesso exclusivo da administração da plataforma."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Building2} eyebrow="Administração do SaaS" title="Empresas" description="Provisione uma nova operação white label e seu primeiro administrador." />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const field = (id: keyof typeof form, label: string, type = 'text') => (
    <div className="space-y-2">
      <Label htmlFor={`company-${id}`}>{label}</Label>
      <Input
        id={`company-${id}`}
        type={type}
        required={['name', 'slug', 'adminName', 'adminEmail', 'adminPassword'].includes(id)}
        value={form[id]}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader icon={Building2} eyebrow="Administração do SaaS" title="Empresas" description="Provisione uma nova operação white label e seu primeiro administrador." />

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar empresas</p>
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
        <CardHeader><CardTitle>Nova empresa</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Dados da Empresa</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {field('name', 'Nome da empresa')}
                {field('slug', 'Identificador (slug)')}
                {field('email', 'Email comercial', 'email')}
                {field('phone', 'Telefone')}
                {field('city', 'Cidade')}
                {field('state', 'Estado')}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Identidade Visual</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('primaryColor', 'Cor principal', 'color')}
                {field('secondaryColor', 'Cor secundária', 'color')}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Administrador Inicial</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {field('adminName', 'Nome do administrador')}
                {field('adminEmail', 'Email do administrador', 'email')}
                {field('adminPassword', 'Senha inicial', 'password')}
              </div>
            </div>

            <Button disabled={saving} type="submit" className="w-full sm:w-auto">
              {saving ? 'Provisionando...' : 'Criar empresa e administrador'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Empresas cadastradas</CardTitle></CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhuma empresa cadastrada"
              description="Preencha o formulário acima para provisionar a primeira operação white label."
              className="min-h-40 border-0 shadow-none"
            />
          ) : (
            <div className="divide-y divide-border">
              {companies.map((company) => (
                <div key={company.id} className="flex justify-between py-3">
                  <span>
                    {company.name}
                    <small className="block text-muted-foreground">{company.slug}</small>
                  </span>
                  <span className="capitalize">{company.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
