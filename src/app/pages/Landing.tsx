import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Car,
  LayoutDashboard,
  Handshake,
  Users,
  BarChart3,
  Palette,
  ArrowRight,
  Check,
  Menu,
  X,
  TrendingUp,
  Sparkles,
  Globe,
  ChevronDown
} from 'lucide-react';

/*
 * Landing de marketing — estética premium dark (independente do tema do app).
 * Vende o SOFTWARE para concessionárias, não o carro.
 */

const brands = ['LuxCar', 'Elite Motors', 'AutoPrime', 'Premium Cars', 'Minha Loja'];

const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard em tempo real',
    desc: 'Receita, lucro, estoque e conversão em um só painel. Decida com dados, não com achismo.'
  },
  {
    icon: Car,
    title: 'Gestão de veículos',
    desc: 'Fotos, preço de compra e venda, status e integração com a Tabela FIPE em cada carro.'
  },
  {
    icon: Handshake,
    title: 'CRM & Pipeline',
    desc: 'Acompanhe cada negociação por estágio, do primeiro contato ao carro vendido.'
  },
  {
    icon: Users,
    title: 'Multi-vendedores',
    desc: 'Equipe, funções e permissões. Cada vendedor com seu funil e suas comissões.'
  },
  {
    icon: BarChart3,
    title: 'Relatórios de verdade',
    desc: 'Lucro por período, desempenho por vendedor e os veículos que mais giram.'
  },
  {
    icon: Palette,
    title: 'White-label',
    desc: 'Sua marca, suas cores e seu domínio. A plataforma vira parte da sua loja.'
  }
];

const plans = [
  {
    name: 'Básico',
    price: 'R$ 199',
    period: '/mês',
    desc: 'Para começar a organizar a operação.',
    features: ['Até 50 veículos', '2 usuários', 'Dashboard e CRM', 'Consulta FIPE'],
    highlight: false
  },
  {
    name: 'Pro',
    price: 'R$ 499',
    period: '/mês',
    desc: 'Para lojas que querem escalar.',
    features: ['Veículos ilimitados', 'Até 10 usuários', 'Relatórios avançados', 'Vitrine pública', 'White-label'],
    highlight: true
  },
  {
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    desc: 'Para redes e grupos automotivos.',
    features: ['Tudo do Pro', 'Usuários ilimitados', 'Domínio próprio', 'Suporte prioritário'],
    highlight: false
  }
];

const faqs = [
  {
    q: 'A LuxCar é white-label mesmo?',
    a: 'Sim. Você configura logo, cores e (em breve) domínio próprio. Seus clientes veem a sua marca, não a nossa.'
  },
  {
    q: 'Preciso instalar algo?',
    a: 'Não. É 100% na nuvem. Você acessa pelo navegador, no computador ou no celular.'
  },
  {
    q: 'Os valores da FIPE são atualizados?',
    a: 'Sim, são consultados em tempo real da Tabela FIPE oficial ao cadastrar cada veículo.'
  },
  {
    q: 'Posto cadastrar toda a minha equipe?',
    a: 'Sim. Cada vendedor tem seu próprio acesso, funil de negociações e acompanhamento de comissões.'
  }
];

function BrandCycle() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % brands.length), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-[#f8a746] transition-all duration-500">{brands[i]}</span>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/8 rounded-2xl bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left"
      >
        <span className="font-medium text-white">{q}</span>
        <ChevronDown className={`w-5 h-5 text-white/50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-5 text-white/60 -mt-1">{a}</p>}
    </div>
  );
}

export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: '#recursos', label: 'Recursos' },
    { href: '#whitelabel', label: 'White-label' },
    { href: '#precos', label: 'Preços' },
    { href: '#faq', label: 'FAQ' }
  ];

  return (
    <div className="min-h-screen bg-[#09090B] text-white antialiased overflow-x-hidden">
      {/* ===== Navbar ===== */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#09090B]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 bg-[#f8a746] rounded-lg">
              <Car className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold">LuxCar</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth/login" className="text-sm font-medium text-white/80 hover:text-white transition-colors px-3 py-2">
              Entrar
            </Link>
            <Link
              to="/auth/register"
              className="text-sm font-semibold bg-[#f8a746] text-black px-4 py-2 rounded-lg hover:bg-[#fb923c] transition-colors"
            >
              Começar agora
            </Link>
          </div>

          <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-white/8 px-4 py-4 space-y-3 bg-[#09090B]">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="block text-white/70 py-1">
                {l.label}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link to="/auth/login" className="flex-1 text-center text-sm font-medium border border-white/15 rounded-lg py-2">Entrar</Link>
              <Link to="/auth/register" className="flex-1 text-center text-sm font-semibold bg-[#f8a746] text-black rounded-lg py-2">Começar</Link>
            </div>
          </div>
        )}
      </header>

      {/* ===== Hero ===== */}
      <section className="relative">
        {/* Fundo premium: grid + glow + gradiente */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)'
            }}
          />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[radial-gradient(circle,rgba(248,167,70,0.18),transparent_60%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 pt-16 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#f8a746] bg-[#f8a746]/10 border border-[#f8a746]/20 rounded-full px-3 py-1 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              CRM white-label para concessionárias
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Venda mais carros com um CRM feito para a sua concessionária.
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-lg">
              Gerencie estoque, negociações, clientes e vendedores em uma única plataforma —
              com a sua marca do início ao fim.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/auth/register"
                className="inline-flex items-center justify-center gap-2 bg-[#f8a746] text-black font-semibold px-6 py-3 rounded-xl hover:bg-[#fb923c] transition-colors"
              >
                Começar agora
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/estoque"
                className="inline-flex items-center justify-center gap-2 border border-white/15 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                Ver estoque de exemplo
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/40">Sem cartão de crédito • Configuração em minutos</p>
          </div>

          {/* Mockup do produto + cards flutuantes */}
          <div className="relative">
            <div className="absolute -inset-6 bg-[radial-gradient(circle,rgba(248,167,70,0.15),transparent_70%)]" />
            <div className="relative rounded-2xl border border-white/10 bg-[#111318] shadow-2xl overflow-hidden">
              {/* barra do "navegador" */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8">
                <span className="w-3 h-3 rounded-full bg-white/15" />
                <span className="w-3 h-3 rounded-full bg-white/15" />
                <span className="w-3 h-3 rounded-full bg-white/15" />
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { l: 'Receita', v: 'R$ 1,2M' },
                    { l: 'Estoque', v: '18' },
                    { l: 'Lucro', v: 'R$ 214k' }
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
                      <p className="text-[11px] text-white/40">{s.l}</p>
                      <p className="text-lg font-bold">{s.v}</p>
                    </div>
                  ))}
                </div>
                {/* mini bar chart */}
                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
                  <p className="text-[11px] text-white/40 mb-3">Vendas por mês</p>
                  <div className="flex items-end gap-2 h-24">
                    {[40, 65, 50, 80, 60, 95].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#f8a746]/40 to-[#f8a746]" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cards flutuantes glass */}
            <div className="absolute -left-4 top-16 hidden sm:block rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 shadow-xl">
              <p className="text-xs text-white/50">Audi A3</p>
              <p className="text-lg font-bold text-[#f8a746]">+ R$ 98.000</p>
            </div>
            <div className="absolute -right-2 bottom-10 hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 shadow-xl">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/50">Negociação</p>
                <p className="text-sm font-semibold">Fechada</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Faixa de valor ===== */}
      <section className="border-y border-white/8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { v: 'Tempo real', l: 'Dados sempre atualizados' },
            { v: 'White-label', l: 'A plataforma é sua marca' },
            { v: 'Multi-loja', l: 'Feito para escalar' },
            { v: 'FIPE oficial', l: 'Preços de referência' }
          ].map((s) => (
            <div key={s.v}>
              <p className="text-2xl font-bold text-[#f8a746]">{s.v}</p>
              <p className="text-sm text-white/50 mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="recursos" className="max-w-7xl mx-auto px-4 py-24">
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tudo que a sua loja precisa para vender mais</h2>
          <p className="mt-4 text-white/60">Uma plataforma completa, no lugar de planilhas soltas e grupos de WhatsApp.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-3xl border border-white/8 bg-white/[0.02] p-6 transition-all hover:border-[#f8a746]/40 hover:bg-white/[0.04] hover:shadow-[0_0_40px_-12px_rgba(248,167,70,0.3)]"
            >
              <div className="w-11 h-11 rounded-xl bg-[#f8a746]/10 border border-[#f8a746]/20 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-[#f8a746]" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== White-label ===== */}
      <section id="whitelabel" className="relative border-y border-white/8 bg-white/[0.02]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(248,167,70,0.12),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#f8a746] bg-[#f8a746]/10 border border-[#f8a746]/20 rounded-full px-3 py-1 mb-6">
              <Globe className="w-3.5 h-3.5" />
              White-label
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
              Sua marca.<br />Seu domínio.<br />Seu sistema.
            </h2>
            <p className="mt-6 text-white/60 max-w-md">
              A LuxCar desaparece e a sua loja aparece. Configure logo, cores e domínio próprio —
              seus clientes e vendedores enxergam apenas a sua identidade.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <div className="rounded-3xl border border-white/10 bg-[#111318] p-12 text-center min-w-[280px]">
              <p className="text-sm text-white/40 mb-3">A mesma plataforma, a sua cara</p>
              <p className="text-4xl md:text-5xl font-bold h-14 flex items-center justify-center">
                <BrandCycle />
              </p>
              <div className="mt-6 h-1 w-24 mx-auto rounded-full bg-gradient-to-r from-transparent via-[#f8a746] to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="precos" className="max-w-7xl mx-auto px-4 py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Planos que crescem com a sua loja</h2>
          <p className="mt-4 text-white/60">Comece simples e evolua conforme a operação cresce.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-3xl border p-6 flex flex-col ${
                p.highlight
                  ? 'border-[#f8a746]/50 bg-[#f8a746]/[0.04] shadow-[0_0_60px_-20px_rgba(248,167,70,0.5)]'
                  : 'border-white/8 bg-white/[0.02]'
              }`}
            >
              {p.highlight && (
                <span className="self-start text-xs font-semibold text-black bg-[#f8a746] rounded-full px-3 py-1 mb-4">
                  Mais popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="text-sm text-white/50 mt-1">{p.desc}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-white/50">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <Check className="w-4 h-4 text-[#f8a746] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth/register"
                className={`mt-8 text-center font-semibold px-4 py-3 rounded-xl transition-colors ${
                  p.highlight
                    ? 'bg-[#f8a746] text-black hover:bg-[#fb923c]'
                    : 'border border-white/15 text-white hover:bg-white/5'
                }`}
              >
                {p.price === 'Sob consulta' ? 'Falar com vendas' : 'Começar agora'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Perguntas frequentes</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f) => (
            <FaqItem key={f.q} {...f} />
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="max-w-7xl mx-auto px-4 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111318] p-10 md:p-16 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(248,167,70,0.2),transparent_60%)]" />
          <div className="relative">
            <TrendingUp className="w-10 h-10 text-[#f8a746] mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-2xl mx-auto">
              Pronto para escalar a sua concessionária?
            </h2>
            <p className="mt-4 text-white/60 max-w-lg mx-auto">
              Organize a operação, acompanhe cada venda e coloque a sua marca no centro de tudo.
            </p>
            <Link
              to="/auth/register"
              className="mt-8 inline-flex items-center gap-2 bg-[#f8a746] text-black font-semibold px-6 py-3 rounded-xl hover:bg-[#fb923c] transition-colors"
            >
              Começar agora
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center w-8 h-8 bg-[#f8a746] rounded-lg">
                <Car className="w-4 h-4 text-black" />
              </div>
              <span className="font-bold">LuxCar</span>
            </div>
            <p className="text-sm text-white/40 max-w-xs">CRM white-label para concessionárias venderem mais.</p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3">Produto</p>
            <ul className="space-y-2 text-sm text-white/50">
              <li><a href="#recursos" className="hover:text-white">Recursos</a></li>
              <li><a href="#whitelabel" className="hover:text-white">White-label</a></li>
              <li><a href="#precos" className="hover:text-white">Preços</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3">Acesso</p>
            <ul className="space-y-2 text-sm text-white/50">
              <li><Link to="/auth/login" className="hover:text-white">Entrar (lojista)</Link></li>
              <li><Link to="/estoque" className="hover:text-white">Ver estoque</Link></li>
              <li><Link to="/client/login" className="hover:text-white">Área do cliente</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3">Legal</p>
            <ul className="space-y-2 text-sm text-white/50">
              <li><span className="hover:text-white cursor-default">Termos</span></li>
              <li><span className="hover:text-white cursor-default">Privacidade</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/8">
          <div className="max-w-7xl mx-auto px-4 py-6 text-sm text-white/40">
            © {new Date().getFullYear()} LuxCar. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
