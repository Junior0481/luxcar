import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BarChart3,
  Car,
  Check,
  ChevronDown,
  Globe,
  Handshake,
  LayoutDashboard,
  Menu,
  Palette,
  Shield,
  Sparkles,
  X
} from 'lucide-react';
import { Button } from '../components/ui/button';
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
    desc: 'Receita, lucro, conversão e desempenho da equipe sem depender de planilhas.'
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

const subscriptionFeatures = [
  'Estoque, veículos e custos',
  'Pipeline de vendas, leads e negociações',
  'Equipe com acessos de administrador e vendedor',
  'Dashboard, relatórios e pagamentos',
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
    a: 'A base já foi pensada para white label. As próximas sprints aprofundam marca, domínio e configurações visuais por loja.'
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
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="font-medium text-foreground">{q}</span>
        <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
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
    { href: '#whitelabel', label: 'White label' },
    { href: '#assinatura', label: 'Assinatura' },
    { href: '#faq', label: 'FAQ' }
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-header border-b border-[#292D33] bg-[#111316] text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lux-sm">
              <Car className="size-5" />
            </div>
            <span className="text-xl font-semibold text-white [font-family:var(--font-display)]">LuxCar</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-[#C9CFD8] transition-colors hover:text-white">
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
                <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><Link to="/auth/login">Entrar</Link></Button>
                <Button asChild><Link to="/auth/register">Falar com vendas</Link></Button>
              </>
            )}
          </div>

          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>

        {menuOpen ? (
          <div className="border-t border-border bg-background px-4 py-4 md:hidden">
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
                  <Button asChild variant="secondary"><Link to="/auth/login">Entrar</Link></Button>
                  <Button asChild><Link to="/auth/register">Falar com vendas</Link></Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section className="border-b border-[#292D33] bg-[#111316] text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-[1fr_0.9fr] lg:py-24">
            <div className="flex flex-col justify-center">
              <Badge variant="outline" className="mb-6 w-fit border-[#3A414B] text-[#FF9A63]">
                <Sparkles className="size-3" />
                SaaS B2B white label para lojas automotivas
              </Badge>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight text-white [font-family:var(--font-display)] md:text-6xl">
                Venda mais carros e gerencie sua loja em uma única plataforma white label.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-[#C9CFD8]">
                A LuxCar organiza estoque, negociações, relatórios e equipe para transformar dados em decisão comercial.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/auth/register">
                    Começar agora
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-[#3A414B] bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <Link to="/estoque">Ver vitrine pública</Link>
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden border-[#292D33] bg-[#171B21] text-white shadow-none">
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#8A93A1]">Centro de comando</p>
                    <p className="text-xl font-semibold [font-family:var(--font-display)]">Visão da loja</p>
                  </div>
                    <Badge variant="outline" className="border-[#343B45] text-[#A3ABB8]">Prévia do produto</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {['Estoque', 'Pipeline', 'Lucro'].map((label, index) => (
                    <div key={label} className="rounded-lg border border-[#292D33] bg-[#121519] p-4">
                      <p className="text-xs text-[#8A93A1]">{label}</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-[#E9ECF1]">—</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-[#292D33] bg-[#121519] p-4">
                  <p className="mb-4 text-sm text-[#8A93A1]">Pipeline comercial</p>
                  <div className="space-y-3">
                    {['Primeiro contato', 'Proposta enviada', 'Documentação'].map((stage, index) => (
                      <div key={stage} className="flex items-center gap-3 rounded-lg border border-[#242930] bg-[#171B21] p-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-[#292D33] text-sm font-semibold text-[#FF9A63]">{index + 1}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#E9ECF1]">{stage}</p>
                          <p className="text-xs text-[#8A93A1]">Próxima ação clara para a equipe</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <CardContent>
                  <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
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
              <CardContent className="space-y-4">
                {['Marca da loja', 'Vitrine pública', 'Equipe comercial', 'Relatórios de gestão'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                    <Check className="size-4 text-primary" />
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="assinatura" className="mx-auto max-w-5xl px-4 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-medium tracking-normal md:text-4xl">Uma assinatura. A LuxCar completa.</h2>
            <p className="mt-4 text-muted-foreground">Tudo liberado em um único produto: do essencial da operação à experiência white label.</p>
          </div>
          <Card className="border-primary/30 bg-accent/40">
            <CardContent className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div>
                <Badge className="mb-4">Produto completo</Badge>
                <h3 className="text-2xl font-medium">Assinatura LuxCar</h3>
                <p className="mt-2 text-sm text-muted-foreground">Após a confirmação do pagamento, nossa equipe configura sua concessionária e entrega o acesso de administrador.</p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {subscriptionFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 shrink-0 text-primary" />{feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild size="lg"><Link to="/auth/register">Solicitar assinatura<ArrowRight className="size-4" /></Link></Button>
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
                  Criar acesso
                  <ArrowRight className="size-4" />
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



