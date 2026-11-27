import { maskPhone, PHONE_MAX_LENGTH } from '../../lib/format';
import { FormEvent, InputHTMLAttributes, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, Check, CheckCircle2, Circle, Globe, Mail, MapPin, Phone, Store, User, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

type Plan = {
  id: 'silver' | 'gold' | 'platinum';
  name: string;
  max_administrators: number;
  max_sellers: number;
  max_vehicles: number;
  reports_enabled: boolean;
  monthly_price: number;
  annual_price: number;
};
type State = { id: number; sigla: string; nome: string };
type City = { id: number; nome: string };
type Address = { logradouro: string; bairro: string; localidade: string; uf: string; erro?: boolean };
type RegistrationDraft = {
  company_name: string; slug: string; owner_name: string; owner_email: string; phone: string | null;
  postal_code: string; address: string; address_number: string; neighborhood: string; city: string; state: string;
  acquisition_source: string | null; plan: string; billing_cycle: string;
};
const registrationDraftKey = 'luxcar-registration-draft';

const emptyForm = {
  companyName: '', slug: '', ownerName: '', ownerEmail: '', phone: '', postalCode: '', address: '',
  addressNumber: '', neighborhood: '', city: '', state: '', acquisitionSource: '', plan: '', billingCycle: 'monthly'
};
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const quantity = (value: number, singular: string, plural: string) => `${value} ${value === 1 ? singular : plural}`;
const readRegistrationDraft = (): RegistrationDraft | null => {
  try {
    const raw = localStorage.getItem(registrationDraftKey);
    return raw ? JSON.parse(raw) as RegistrationDraft : null;
  } catch {
    return null;
  }
};
const formFromDraft = (draft: RegistrationDraft) => ({
  ...emptyForm, companyName: draft.company_name, slug: draft.slug, ownerName: draft.owner_name,
  ownerEmail: draft.owner_email, phone: draft.phone || '', postalCode: draft.postal_code,
  address: draft.address, addressNumber: draft.address_number, neighborhood: draft.neighborhood,
  city: draft.city, state: draft.state, acquisitionSource: draft.acquisition_source || '',
  plan: draft.plan, billingCycle: draft.billing_cycle
});

export function Register() {
  const [form, setForm] = useState(() => {
    const draft = readRegistrationDraft();
    return draft ? formFromDraft(draft) : emptyForm;
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [step, setStep] = useState<1 | 2>(() => readRegistrationDraft() ? 2 : 1);
  const [error, setError] = useState('');
  const [cepMessage, setCepMessage] = useState(() => readRegistrationDraft()?.address ? 'Endereço recuperado do cadastro salvo.' : '');
  const [addressFound, setAddressFound] = useState(() => Boolean(readRegistrationDraft()?.address));
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const cepRequestId = useRef(0);

  useEffect(() => {
    void Promise.all([
      supabase.from('plans').select('id,name,max_administrators,max_sellers,max_vehicles,reports_enabled,monthly_price,annual_price').order('monthly_price'),
      fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome').then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os estados.');
        return response.json() as Promise<State[]>;
      })
    ]).then(([plansResult, statesResult]) => {
      if (plansResult.error) throw plansResult.error;
      setPlans((plansResult.data || []) as Plan[]);
      setStates(statesResult);
    }).catch((loadError) => setError(loadError.message || 'Não foi possível carregar os dados do cadastro.'));
  }, []);

  useEffect(() => {
    if (!form.state) { setCities([]); return; }
    let active = true;
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.state}/municipios?orderBy=nome`)
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar as cidades.');
        return response.json() as Promise<City[]>;
      })
      .then((data) => { if (active) setCities(data); })
      .catch(() => { if (active) setError('Não foi possível carregar as cidades deste estado.'); });
    return () => { active = false; };
  }, [form.state]);

  const update = (key: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const selectedPlan = plans.find((plan) => plan.id === form.plan);
  const previewSlug = form.slug.trim() || slugify(form.companyName);

  const lookupCep = async (value: string) => {
    const requestId = ++cepRequestId.current;
    const postalCode = value.replace(/\D/g, '');
    if (postalCode.length !== 8) { setCepMessage(''); return; }
    setCepMessage('Consultando CEP…');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`);
      if (!response.ok) throw new Error();
      const address = await response.json() as Address;
      if (requestId !== cepRequestId.current) return;
      if (address.erro) { setCepMessage('CEP não encontrado. Confira e tente novamente.'); return; }
      setForm((current) => ({ ...current, address: address.logradouro || '', neighborhood: address.bairro || '', city: address.localidade || '', state: address.uf || '' }));
      setAddressFound(true);
      setCepMessage('Endereço localizado e preenchido pelo ViaCEP.');
    } catch {
      if (requestId === cepRequestId.current) setCepMessage('Não foi possível consultar o CEP. Confira sua conexão e tente novamente.');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const draft: RegistrationDraft = {
        company_name: form.companyName.trim(), slug: form.slug.trim() || slugify(form.companyName),
        owner_name: form.ownerName.trim(), owner_email: form.ownerEmail.trim().toLowerCase(), phone: form.phone.trim() || null,
        postal_code: form.postalCode.replace(/\D/g, ''), address: form.address.trim(), address_number: form.addressNumber.trim(),
        neighborhood: form.neighborhood.trim(), city: form.city, state: form.state,
        acquisition_source: form.acquisitionSource || null, plan: form.plan, billing_cycle: form.billingCycle
      };
      localStorage.setItem(registrationDraftKey, JSON.stringify(draft));
      const { error: requestError } = await supabase.auth.signInWithOtp({
        email: draft.owner_email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/register/confirm`,
          shouldCreateUser: true,
          data: { full_name: draft.owner_name }
        }
      });
      if (requestError) throw requestError;
      setAwaitingConfirmation(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar o link de confirmação.');
    } finally {
      setLoading(false);
    }
  };

  const input = (key: keyof typeof emptyForm, label: string, Icon: typeof Store, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/65" />
        <Input id={key} value={form[key]} onChange={(event) => update(key, key === 'phone' ? maskPhone(event.target.value) : event.target.value)} className="pl-10 text-foreground placeholder:text-foreground/60" {...props} />
      </div>
    </div>
  );

  return (
    <Card className="w-full shadow-lux-lg">
      <CardHeader className="pb-5">
        <CardTitle as="h1" className="text-2xl">Solicitar assinatura LuxCar</CardTitle>
        <CardDescription>{awaitingConfirmation ? 'Confirme seu email para concluir a solicitação.' : step === 1 ? 'Escolha o plano para sua concessionária.' : 'Informe os dados da concessionária e do responsável.'}</CardDescription>
        {!awaitingConfirmation && <ol aria-label="Etapas do cadastro" className="mt-5 grid grid-cols-2 gap-3">
          {[{ number: 1, label: 'Plano' }, { number: 2, label: 'Dados da loja' }].map((item) => (
            <li key={item.number} aria-current={step === item.number ? 'step' : undefined} className={`flex items-center gap-2 border-b-2 pb-2 text-sm ${step === item.number ? 'border-primary font-semibold text-foreground' : 'border-border text-foreground/70'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-xs ${step === item.number ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/75'}`}>{item.number}</span>{item.label}
            </li>
          ))}
        </ol>}
      </CardHeader>
      <CardContent>
        {awaitingConfirmation ? (
          <div className="space-y-4 rounded-2xl border border-primary/20 bg-accent p-5">
            <div className="flex items-center gap-2 font-medium text-accent-foreground"><Mail className="size-5 text-primary-text" /> Confirme seu email</div>
            <p className="text-sm leading-6 text-foreground/75">Enviamos um link para <strong>{form.ownerEmail}</strong>. Abra-o neste navegador para validar o email e registrar sua solicitação. Confira também a caixa de spam.</p>
            <Button type="button" variant="outline" disabled={loading} onClick={() => { setAwaitingConfirmation(false); setError(''); }}>
              Voltar ao cadastro
            </Button>
          </div>
        ) : (
          <>
            {error && <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-destructive">{error}</p></div>}
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 ? (
                <section className="space-y-4" aria-labelledby="plan-heading">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="plan-heading" className="font-semibold">Escolha seu plano</h2>
                    <div className="inline-flex items-center rounded-xl border border-border bg-muted/70 p-1" role="group" aria-label="Periodicidade do plano">
                      <button type="button" aria-pressed={form.billingCycle === 'monthly'} onClick={() => update('billingCycle', 'monthly')} className={`rounded-lg px-4 py-2 text-sm font-medium ${form.billingCycle === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/75 hover:text-foreground'}`}>Mensal</button>
                      <button type="button" aria-pressed={form.billingCycle === 'annual'} onClick={() => update('billingCycle', 'annual')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${form.billingCycle === 'annual' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/75 hover:text-foreground'}`}>
                        Anual <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-text">2 meses grátis</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {plans.map((plan) => {
                      const isSelected = form.plan === plan.id;
                      const isAnnual = form.billingCycle === 'annual';
                      const price = Number(isAnnual ? plan.annual_price : plan.monthly_price);
                      const annualSavings = Number(plan.monthly_price) * 12 - Number(plan.annual_price);
                      const features = [
                        { included: true, label: quantity(plan.max_administrators, 'administrador', 'administradores') },
                        { included: true, label: quantity(plan.max_sellers, 'vendedor', 'vendedores') },
                        { included: true, label: quantity(plan.max_vehicles, 'veículo', 'veículos') },
                        { included: plan.reports_enabled, label: `Relatórios ${plan.reports_enabled ? 'incluídos' : 'não incluídos'}` }
                      ];
                      return (
                        <button key={plan.id} type="button" onClick={() => update('plan', plan.id)} className={`relative flex h-full min-h-[290px] w-full flex-col rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? 'border-primary bg-primary/5 shadow-lux-sm ring-2 ring-primary/25' : 'border-border bg-card hover:border-primary/50'}`} aria-pressed={isSelected}>
                          <span className="flex w-full items-start justify-between gap-2">
                            <span className="text-lg font-semibold">{plan.name}</span>
                            {isSelected ? <CheckCircle2 aria-label="Plano selecionado" className="size-5 shrink-0 text-primary-text" /> : <Circle aria-hidden="true" className="size-5 shrink-0 text-foreground/50" />}
                          </span>
                          {plan.id === 'gold' && <span className="mt-2 w-fit rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary-text">Mais popular</span>}
                          <span className="mt-4 block whitespace-nowrap text-[clamp(1.15rem,2vw,1.4rem)] font-bold tracking-tight">{money(price)}<span className="ml-1 text-sm font-medium text-foreground/75">/{isAnnual ? 'ano' : 'mês'}</span></span>
                          {isAnnual ? <span className="mt-1 text-xs text-foreground/75">Equivale a {money(price / 12)}/mês · economize {money(annualSavings)}</span> : <span className="mt-1 text-xs text-foreground/75">Cobrança mensal</span>}
                          <span className="my-4 block h-px w-full bg-border" />
                          <span className="grid gap-2 text-sm">
                            {features.map((feature) => <span key={feature.label} className="flex items-center gap-2"><span className={feature.included ? 'text-primary-text' : 'text-destructive'}>{feature.included ? <Check aria-hidden="true" className="size-4" /> : <X aria-hidden="true" className="size-4" />}</span><span className="text-foreground/80">{feature.label}</span></span>)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {plans.length === 0 && <p className="text-sm text-foreground/75">Carregando planos…</p>}
                  <Button type="button" disabled={!selectedPlan} onClick={() => { setError(''); setStep(2); }} className="w-full" size="lg">Continuar com {selectedPlan?.name || 'plano'}</Button>
                </section>
              ) : (
                <section className="space-y-5" aria-labelledby="store-heading">
                  <h2 id="store-heading" className="font-semibold">Dados da concessionária</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {input('companyName', 'Nome da concessionária *', Store, { required: true, autoComplete: 'organization', placeholder: 'Ex.: LuxCar São Paulo' })}
                    {input('slug', 'Endereço do seu site', Globe, { placeholder: 'gerado pelo nome', 'aria-describedby': 'site-preview' })}
                    <p id="site-preview" className="-mt-2 text-xs text-foreground/75 sm:col-span-2">Prévia: <span className="font-medium text-foreground">luxcar.com.br/{previewSlug || 'sua-loja'}</span></p>
                    {input('ownerName', 'Nome do proprietário *', User, { required: true, autoComplete: 'name', placeholder: 'Ex.: Maria Silva' })}
                    {input('ownerEmail', 'Email para acesso *', Mail, { type: 'email', required: true, autoComplete: 'email', placeholder: 'voce@empresa.com.br' })}
                    {input('phone', 'Telefone (opcional)', Phone, { type: 'tel', autoComplete: 'tel', maxLength: PHONE_MAX_LENGTH, placeholder: '(11) 99999-9999' })}
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="postalCode">CEP *</Label>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/65" />
                        <Input id="postalCode" required inputMode="numeric" autoComplete="postal-code" maxLength={9} value={form.postalCode} placeholder="00000-000" className="pl-10 text-foreground placeholder:text-foreground/60" aria-describedby="cep-status" onChange={(event) => {
                          const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
                          setAddressFound(false);
                          setForm((current) => ({ ...current, postalCode: digits.replace(/^(\d{5})(\d)/, '$1-$2'), address: '', neighborhood: '', city: '', state: '' }));
                          void lookupCep(digits);
                        }} />
                      </div>
                      <p id="cep-status" role="status" className="min-h-5 text-xs text-foreground/75">{cepMessage || 'Digite o CEP para preencher o endereço automaticamente.'}</p>
                    </div>
                    {addressFound && <>
                      <div className="space-y-2 sm:col-span-2"><Label htmlFor="address">Rua</Label><Input id="address" readOnly value={form.address} placeholder="Rua não informada pelo CEP" className="bg-muted/60 text-foreground read-only:opacity-100" /></div>
                      <div className="space-y-2"><Label htmlFor="addressNumber">Número *</Label><Input id="addressNumber" required value={form.addressNumber} onChange={(event) => update('addressNumber', event.target.value)} placeholder="Ex.: 123" className="text-foreground placeholder:text-foreground/60" /></div>
                      <div className="space-y-2"><Label htmlFor="neighborhood">Bairro</Label><Input id="neighborhood" readOnly value={form.neighborhood} placeholder="Bairro não informado pelo CEP" className="bg-muted/60 text-foreground read-only:opacity-100" /></div>
                      <div className="space-y-2"><Label htmlFor="city">Cidade</Label><select id="city" disabled className="h-10 w-full rounded-lg border border-input bg-muted/60 px-3 text-sm text-foreground disabled:opacity-100"><option value={form.city}>{form.city}</option>{cities.filter((city) => city.nome !== form.city).map((city) => <option key={city.id} value={city.nome}>{city.nome}</option>)}</select></div>
                      <div className="space-y-2"><Label htmlFor="state">UF</Label><select id="state" disabled className="h-10 w-full rounded-lg border border-input bg-muted/60 px-3 text-sm text-foreground disabled:opacity-100"><option value={form.state}>{form.state}</option>{states.filter((state) => state.sigla !== form.state).map((state) => <option key={state.id} value={state.sigla}>{state.sigla}</option>)}</select></div>
                    </>}
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="acquisitionSource">Como conheceu a plataforma? <span className="text-foreground/70">(opcional)</span></Label><select id="acquisitionSource" className="h-10 w-full rounded-lg border border-input bg-input-background px-3 text-sm text-foreground" value={form.acquisitionSource} onChange={(event) => update('acquisitionSource', event.target.value)}><option value="">Prefiro não informar</option><option value="instagram">Instagram</option><option value="google">Google</option><option value="referral">Indicação</option><option value="other">Outro</option></select></div>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm text-foreground/75">Resumo da assinatura</p>
                    <p className="mt-1 font-semibold text-foreground">{selectedPlan?.name} · {money(Number(form.billingCycle === 'annual' ? selectedPlan?.annual_price : selectedPlan?.monthly_price))}/{form.billingCycle === 'annual' ? 'ano' : 'mês'}</p>
                    <p className="mt-1 text-xs text-foreground/75">Após confirmar seu email, a equipe LuxCar confere o pagamento manualmente.</p>
                  </div>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Button type="button" variant="outline" onClick={() => { setError(''); setStep(1); }}>Voltar aos planos</Button>
                    <Button type="submit" disabled={loading || !addressFound || !form.addressNumber.trim()} size="lg">{loading ? 'Enviando link…' : 'Confirmar email e continuar'}</Button>
                  </div>
                </section>
              )}
            </form>
          </>
        )}
        <p className="mt-6 text-center text-sm text-foreground/75">Já tem conta? <Link to="/auth/login" className="font-medium text-primary-text hover:underline">Entrar</Link></p>
      </CardContent>
    </Card>
  );
}
