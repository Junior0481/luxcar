import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Negotiation, Vehicle, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Filter, Handshake, List, LayoutGrid, Plus, RefreshCw, Search } from 'lucide-react';
import { NegotiationForm } from '../components/NegotiationForm';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import { toast } from 'sonner';
import { formatPhone, formatPriority, formatStage, pluralize, stageLabels } from '../../lib/format';

type NegotiationWithDetails = Negotiation & {
  vehicle?: Vehicle;
  seller?: Profile;
};

const stageVariant = (stage: string): 'default' | 'secondary' | 'outline' | 'destructive' =>
  stage === 'finalizado' ? 'default' : stage === 'perdido' ? 'destructive' : 'secondary';

const priorityMeta: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' }> = {
  alta: { label: 'Alta', variant: 'destructive' },
  media: { label: 'Média', variant: 'default' },
  baixa: { label: 'Baixa', variant: 'outline' }
};

export function Negotiations() {
  const { profile } = useAuth();
  const [negotiations, setNegotiations] = useState<NegotiationWithDetails[]>([]);
  const [filteredNegotiations, setFilteredNegotiations] = useState<NegotiationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('active');
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  useEffect(() => {
    if (profile?.company_id) loadNegotiations();
  }, [profile?.company_id]);

  useEffect(() => {
    filterNegotiations();
  }, [searchTerm, stageFilter, negotiations]);

  const loadNegotiations = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const { data, error } = await supabase
        .from('negotiations')
        .select(`
          *,
          vehicle:vehicles(*),
          seller:profiles(*)
        `)
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNegotiations(data || []);
    } catch (err: any) {
      console.error('Error loading negotiations:', err);
      const text = err?.message || 'Erro ao carregar negociações.';
      if (silent) {
        toast.error(`Ação concluída, mas não foi possível atualizar a lista: ${text}`);
      } else {
        setError(text);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const filterNegotiations = () => {
    let filtered = negotiations;

    if (stageFilter === 'active') {
      filtered = filtered.filter(n => !['finalizado', 'perdido'].includes(n.stage));
    } else if (stageFilter !== 'all') {
      filtered = filtered.filter(n => n.stage === stageFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (n) =>
          n.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.client_phone?.includes(searchTerm) ||
          n.vehicle?.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.vehicle?.model.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredNegotiations(filtered);
  };

  const summary = useMemo(() => {
    const active = negotiations.filter((n) => !['finalizado', 'perdido'].includes(n.stage)).length;
    const highPriority = negotiations.filter((n) => n.priority === 'alta' && !['finalizado', 'perdido'].includes(n.stage)).length;
    const closed = negotiations.filter((n) => n.stage === 'finalizado').length;
    return { active, highPriority, closed };
  }, [negotiations]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Handshake}
        eyebrow="Pipeline comercial"
        title="Negociações"
        description="Acompanhe cada oportunidade pelo cliente, veículo, prioridade e próxima etapa de venda."
        action={(
          <Button size="lg" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Nova negociação
          </Button>
        )}
      />

      <section aria-label="Resumo das negociações" className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card">
        {[
          { title: 'Pipeline ativo', value: summary.active, note: pluralize(summary.active, 'negociação ativa', 'negociações ativas') },
          { title: 'Alta prioridade', value: summary.highPriority, note: 'Precisam de ação rápida' },
          { title: 'Finalizadas', value: summary.closed, note: 'Negócios ganhos' },
        ].map((item) => <div key={item.title} className="border-r border-border px-3 py-3 last:border-r-0 sm:px-5"><p className="text-xs text-muted-foreground">{item.title}</p><p className="mt-1 text-2xl font-bold tabular-nums text-foreground [font-family:var(--font-display)]">{item.value}</p><p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{item.note}</p></div>)}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1" aria-label="Modo de visualização">
          <Button type="button" size="sm" variant={viewMode === 'board' ? 'secondary' : 'ghost'} aria-pressed={viewMode === 'board'} onClick={() => setViewMode('board')}><LayoutGrid className="size-4" /><span className="hidden sm:inline">Quadro</span></Button>
          <Button type="button" size="sm" variant={viewMode === 'list' ? 'secondary' : 'ghost'} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List className="size-4" /><span className="hidden sm:inline">Lista</span></Button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar por cliente ou veículo"
              placeholder="Buscar por cliente ou veículo"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative sm:w-72">
            <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="pl-10" aria-label="Filtrar por etapa">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="primeiro_contato">Primeiro contato</SelectItem>
                <SelectItem value="avaliacao">Avaliação</SelectItem>
                <SelectItem value="test_drive_agendado">Test drive agendado</SelectItem>
                <SelectItem value="test_drive_realizado">Test drive realizado</SelectItem>
                <SelectItem value="proposta_enviada">Proposta enviada</SelectItem>
                <SelectItem value="negociacao_preco">Negociação de preço</SelectItem>
                <SelectItem value="aprovacao_credito">Aprovação de crédito</SelectItem>
                <SelectItem value="documentacao">Documentação</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar negociações</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadNegotiations()} className="w-fit">
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : filteredNegotiations.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Nenhuma negociação encontrada"
          description={
            searchTerm || stageFilter !== 'active'
              ? 'Ajuste os filtros para encontrar a oportunidade certa.'
              : 'Crie a primeira negociação para acompanhar cliente, veículo e etapa comercial.'
          }
          action={
            !searchTerm && stageFilter === 'active' ? (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                Nova negociação
              </Button>
            ) : null
          }
        />
      ) : (
        viewMode === 'board' ? <div className="flex gap-3 overflow-x-auto pb-3">
          {Object.entries(stageLabels).filter(([stage]) => stage !== 'finalizado' && stage !== 'perdido').map(([stage, label]) => {
            const cards = filteredNegotiations.filter((item) => item.stage === stage);
            return <section key={stage} aria-label={label} className="flex w-[264px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/35 p-3">
              <div className="flex items-center justify-between px-0.5"><h2 className="text-[13px] font-semibold text-foreground">{label}</h2><span className="text-xs tabular-nums text-muted-foreground">{cards.length}</span></div>
              {cards.length ? cards.map((item) => <Link key={item.id} to={`/dashboard/negotiations/${item.id}`} className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50">
                <div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold text-foreground">{item.client_name}</span><Badge variant={priorityMeta[item.priority]?.variant ?? 'outline'} className="shrink-0">{formatPriority(item.priority) || 'Média'}</Badge></div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{item.vehicle ? `${item.vehicle.brand} ${item.vehicle.model}` : 'Veículo não informado'}</p>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground"><span className="truncate">{item.seller?.full_name || 'Sem responsável'}</span><span className="tabular-nums">{new Date(item.created_at).toLocaleDateString('pt-BR')}</span></div>
              </Link>) : <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">Nenhuma oportunidade</p>}
            </section>;
          })}
          {['finalizado', 'perdido'].some((stage) => filteredNegotiations.some((item) => item.stage === stage)) && <section className="flex w-[220px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/35 p-3"><h2 className="px-0.5 text-[13px] font-semibold text-muted-foreground">Encerradas</h2>{filteredNegotiations.filter((item) => ['finalizado', 'perdido'].includes(item.stage)).map((item) => <Link key={item.id} to={`/dashboard/negotiations/${item.id}`} className="rounded-lg border border-border bg-card p-3"><span className="block truncate text-sm font-semibold">{item.client_name}</span><span className="mt-1 block text-xs text-muted-foreground">{stageLabels[item.stage]}</span></Link>)}</section>}
        </div> : <div className="grid gap-4 xl:grid-cols-2">
          {filteredNegotiations.map((negotiation) => {
            const p = priorityMeta[negotiation.priority] ?? priorityMeta.media;
            return (
              <Card key={negotiation.id} className="lux-card-hover">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <h3 className="truncate text-lg font-medium text-foreground">{negotiation.client_name}</h3>
                      {negotiation.client_phone ? (
                        <p className="text-sm text-muted-foreground">{formatPhone(negotiation.client_phone)}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={stageVariant(negotiation.stage)}>
                        {formatStage(negotiation.stage)}
                      </Badge>
                      <Badge variant={p.variant}>{formatPriority(negotiation.priority)}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Veículo</p>
                      <p className="font-medium text-foreground">
                        {negotiation.vehicle
                          ? `${negotiation.vehicle.brand} ${negotiation.vehicle.model}`
                          : 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vendedor</p>
                      <p className="font-medium text-foreground">{negotiation.seller?.full_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Criada em</p>
                      <p className="font-medium text-foreground">
                        {new Date(negotiation.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <Button asChild variant="secondary" className="w-full sm:w-auto">
                    <Link to={`/dashboard/negotiations/${negotiation.id}`}>Ver oportunidade</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NegotiationForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          loadNegotiations({ silent: true });
        }}
      />
    </div>
  );
}



