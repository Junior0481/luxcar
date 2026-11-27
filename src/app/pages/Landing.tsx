import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BarChart3,
  Car,
  Check,
  ChevronDown,
  Clock,
  Globe,
  Handshake,
  LayoutDashboard,
  Menu,
  Palette,
  Shield,
  Store,
  X
} from 'lucide-react';
import demoCarImg from '../../assets/login_img.png';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/ThemeToggle';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../../contexts/AuthContext';

const features = [
  {
    icon: LayoutDashboard,
    title: 'Centro de comando',
    desc: 'KPIs, estoque e pipeline em uma visão clara para decidir o próximo movimento.'
  },
  {
    icon: Car,
    title: 'Estoque premium',
    desc: 'Cada veículo com foto, preço, status, margem e contexto comercial.'
  },
  {
    icon: Handshake,
    title: 'Pipeline de vendas',
    desc: 'Negociações organizadas por etapa, prioridade, cliente, vendedor e veículo.'
  },
  {
    icon: BarChart3,
    title: 'Relatórios acionáveis',
    desc: 'Receita, lucro, conversão e desempenho da equipe nos planos Gold e Platinum.'
  },
  {
    icon: Palette,
    title: 'White label',
    desc: 'A operação pode ganhar identidade da loja: marca, experiência e presença própria.'
  },
  {
    icon: Shield,
    title: 'Base para escala',
    desc: 'Produto pensado para lojas, equipes e operações que precisam de controle.'
  }
];

// Prévia do hero: dados ilustrativos, sempre identificados como demonstração.
const demoKpis = [
  { label: 'Veículos em estoque', value: '32', unit: 'veículos' },
  { label: 'Negociações abertas', value: '18', unit: 'oportunidades' },
  { label: 'Vendas no mês', value: '8', unit: 'veículos', highlight: true }
];

const demoPipeline = [
  { vehicle: 'Mercedes-Benz C 200', client: 'Rafael Moreira', stage: 'Proposta enviada', tone: 'bg-accent text-primary-text', photo: true },
  { vehicle: 'Honda Civic EXL', client: 'Juliana Prado', stage: 'Test drive agendado', tone: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' },
  { vehicle: 'Jeep Compass Longitude', client: 'Carlos Lima', stage: 'Documentação', tone: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' }
];

const benefits = [
  { icon: Car, title: 'Estoque organizado', desc: 'Fotos, preço, custos e status de cada veículo.' },
  { icon: Handshake, title: 'Negociações acompanhadas', desc: 'Cada cliente na etapa certa, com a próxima ação.' },
  { icon: Store, title: 'Vitrine com sua marca', desc: 'Seus carros publicados com o nome e as cores da loja.' }
];

const subscriptionFeatures = [
  'Estoque, veículos e custos',
  'Pipeline de vendas, leads e negociações',
  'Equipe com acessos de administrador e vendedor',
  'Dashboard operacional e controle de pagamentos',
  'Vitrine pública da concessionária',
  'Identidade visual white label da loja'
];

const faqs = [
  {
    q: 'A LuxCar substitui planilhas?',
    a: 'Sim. A proposta é centralizar estoque, negociações e indicadores em uma operação mais organizada.'
  },
  {
    q: 'A plataforma é white label?',
    a: 'Sim. Cada loja usa nome, logo e cores próprios no painel e na vitrine. O domínio próprio é ativado pela equipe LuxCar.'
  },
  {
    q: 'Preciso instalar algo?',
    a: 'Não. A experiência roda no navegador e funciona em desktop e mobile.'
  }
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="font-medium text-foreground">{q}</span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <p className="px-5 pb-5 text-sm text-muted-foreground">{a}</p> : null}
    </div>
  );
}

export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, profile, loading } = useAuth();
  const dashboardPath = profile?.role === 'platform_admin' ? '/dashboard/platform' : '/dashboard';

  const navLinks = [
    { href: '#recursos', label: 'Recursos' },
    { href: '#whitelabel', label: 'Sua marca' },
    { href: '#assinatura', label: 'Assinatura' },
    { href: '#faq', label: 'FAQ' }
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-header border-b border-border bg-card/90 text-foreground backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lux-sm">
              <Car className="size-5" />
            </div>
            <span className="text-xl font-semibold text-heading [font-family:var(--font-display)]">LuxCar</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {!loading && user && profile ? (
              <>
                <span className="text-sm text-muted-foreground">{profile.full_name} · {profile.role}</span>
                <Button asChild><Link to={dashboardPath}>Ir para o painel</Link></Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost"><Link to="/auth/login">Entrar</Link></Button>
                <Button asChild><Link to="/auth/register">Criar minha conta</Link></Button>
              </>
            )}
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="landing-mobile-menu">
              {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <div id="landing-mobile-menu" className="border-t border-border bg-background px-4 py-4 md:hidden">
            <div className="space-y-2">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-muted-foreground">
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 min-[340px]:grid-cols-2 gap-3">
              {!loading && user && profile ? (
                <Button asChild className="min-[340px]:col-span-2"><Link to={dashboardPath}>Painel · {profile.full_name}</Link></Button>
              ) : (
                <>
                  <Button asChild className="min-[340px]:col-span-2"><Link to="/auth/register">Criar minha conta</Link></Button>
                  <Button asChild variant="secondary"><Link to="/auth/login">Entrar</Link></Button>
                  <Button asChild variant="outline"><Link to="/estoque" onClick={() => setMenuOpen(false)}>Loja de exemplo</Link></Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section className="border-b border-border bg-background text-foreground">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:py-20">
            <div className="min-w-0">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-3 py-1 text-sm font-medium text-foreground">
                <Car className="size-4 text-primary-text" aria-hidden="true" />
                Gestão para lojas de veículos
              </p>
              <h1 className="text-[40px] font-bold leading-[1.04] tracking-tight text-heading [font-family:var(--font-display)] sm:text-5xl xl:text-[56px]">
                <span className="block">Sua loja no controle.</span>
                <span className="block text-primary-text">Mais negócios fechados.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Organize estoque, negociações e resultados em um só lugar. Tenha também uma vitrine de veículos com a marca da sua loja.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/auth/register">
                    Criar minha conta
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-card text-foreground hover:bg-accent">
                  <Link to="/estoque">Explorar loja de exemplo</Link>
                </Button>
              </div>
            </div>

            <figure className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-lux-lg sm:p-6" aria-labelledby="landing-demo-caption">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Painel da loja</p>
                  <p className="text-xl font-semibold text-heading [font-family:var(--font-display)]">Visão de hoje</p>
                </div>
                <figcaption id="landing-demo-caption" className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                  Demonstração · dados fictícios
                </figcaption>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                {demoKpis.map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-border bg-background p-3 sm:p-4">
                    <dt className="text-xs font-medium text-muted-foreground">{kpi.label}</dt>
                    <dd className="mt-2 flex items-baseline gap-1.5">
                      <span className={`text-2xl font-bold tabular-nums [font-family:var(--font-display)] sm:text-3xl ${kpi.highlight ? 'text-primary-text' : 'text-foreground'}`}>{kpi.value}</span>
                      <span className="sr-only text-xs text-muted-foreground sm:not-sr-only">{kpi.unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 rounded-xl border border-border">
                <p className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Negociações em andamento</p>
                <ul className="divide-y divide-border">
                  {demoPipeline.map((item) => (
                    <li key={item.vehicle} className="flex items-center gap-3 px-4 py-3">
                      {item.photo ? (
                        <img src={demoCarImg} alt="" className="size-11 shrink-0 rounded-lg object-cover object-[70%_70%]" />
                      ) : (
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
                          <Car className="size-5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.vehicle}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.client}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${item.tone}`}>{item.stage}</span>
                    </li>
                  ))}
                </ul>
                <p className="flex items-center gap-2 border-t border-border bg-accent/60 px-4 py-3 text-sm text-foreground">
                  <Clock className="size-4 shrink-0 text-primary-text" aria-hidden="true" />
                  <span><span className="font-semibold">Próxima ação:</span> retornar para Rafael às 14h</span>
                </p>
              </div>
            </figure>
          </div>

          <div className="border-t border-border bg-card">
            <ul className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3" aria-label="Principais benefícios">
              {benefits.map((benefit) => (
                <li key={benefit.title} className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-text" aria-hidden="true">
                    <benefit.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{benefit.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{benefit.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-7xl px-4 py-20">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-medium tracking-normal md:text-4xl">Organização que aparece no dia a dia da loja</h2>
            <p className="mt-4 text-muted-foreground">Menos painel administrativo, mais clareza operacional para vender.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="lux-card-hover">
                <CardContent className="pt-6">
                  <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-accent text-primary-text">
                    <feature.icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-medium">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="whitelabel" className="border-y border-border bg-muted/30">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="outline" className="mb-6">
                <Globe className="size-3" />
                White label
              </Badge>
              <h2 className="text-3xl font-medium tracking-normal md:text-5xl">A plataforma com a cara da sua loja.</h2>
              <p className="mt-5 max-w-xl text-muted-foreground">
                A LuxCar foi preparada para evoluir identidade, marca, domínio e experiência da loja sem perder consistência operacional.
              </p>
            </div>
            <Card>
              <CardContent className="space-y-4 pt-6">
                {['Marca da loja', 'Vitrine pública', 'Equipe comercial', 'Relatórios de gestão'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                    <Check className="size-4 text-primary-text" />
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="assinatura" className="mx-auto max-w-5xl px-4 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-medium tracking-normal md:text-4xl">Planos para cada etapa da sua loja.</h2>
            <p className="mt-4 text-muted-foreground">Escolha os limites de equipe e estoque que fazem sentido para a sua operação. Os valores aparecem no cadastro.</p>
          </div>
          <Card className="border-primary/30 bg-accent/40">
            <CardContent className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div>
                <Badge className="mb-4">Silver · Gold · Platinum</Badge>
                <h3 className="text-2xl font-medium">Escolha seu plano LuxCar</h3>
                <p className="mt-2 text-sm text-muted-foreground">Após a confirmação do pagamento, nossa equipe configura sua concessionária e entrega o acesso de administrador.</p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {subscriptionFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 shrink-0 text-primary-text" />{feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild size="lg"><Link to="/auth/register">Criar minha conta<ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
            </CardContent>
          </Card>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-medium tracking-normal">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} {...faq} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20">
          <Card className="overflow-hidden bg-accent/70">
            <CardContent className="py-12 text-center md:py-16">
              <h2 className="mx-auto max-w-2xl text-3xl font-medium tracking-normal md:text-4xl">
                Pronto para organizar a operação da sua loja?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Comece pela base: estoque claro, pipeline visível e decisões com mais contexto.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link to="/auth/register">
                  Criar minha conta
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Car className="size-4" />
            </div>
            <span className="font-medium text-foreground">LuxCar</span>
          </div>
          <p>LuxCar - organização comercial para lojas automotivas.</p>
        </div>
      </footer>
    </div>
  );
}



