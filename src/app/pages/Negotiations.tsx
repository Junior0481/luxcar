import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Negotiation, Vehicle, Profile } from '../../lib/supabase';
import { CalendarDays, Filter, Handshake, Plus, Search, UserRound } from 'lucide-react';
import { NegotiationForm } from '../components/NegotiationForm';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { MetricCard } from '../components/ui/metric-card';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';

type NegotiationWithDetails = Negotiation & {
  vehicle?: Vehicle;
  seller?: Profile;
};

const stageLabels: Record<string, string> = {
  primeiro_contato: 'Primeiro contato',
  avaliação: 'Avaliação',
  test_drive_agendado: 'Test drive agendado',
  test_drive_realizado: 'Test drive realizado',
  proposta_enviada: 'Proposta enviada',
  negociação_preço: 'Negociação de preço',
  aprovação_credito: 'Aprovação de crédito',
  documentação: 'Documentação',
  finalizado: 'Finalizado',
  perdido: 'Perdido'
};

const stageVariant = (stage: string): 'default' | 'secondary' | 'outline' | 'destructive' =>
  stage === 'finalizado' ? 'default' : stage === 'perdido' ? 'destructive' : 'secondary';

const priorityMeta: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' }> = {
  alta: { label: 'Alta', variant: 'destructive' },
  media: { label: 'Media', variant: 'default' },
  baixa: { label: 'Baixa', variant: 'outline' }
};

export function Negotiations() {
  const [negotiations, setNegotiations] = useState<NegotiationWithDetails[]>([]);
  const [filteredNegotiations, setFilteredNegotiations] = useState<NegotiationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('active');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadNegotiations();
  }, []);

  useEffect(() => {
    filterNegotiations();
  }, [searchTerm, stageFilter, negotiations]);

  const loadNegotiations = async () => {
    try {
      const { data, error } = await supabase
        .from('negotiations')
        .select(`
          *,
          vehicle:vehicles(*),
          seller:profiles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNegotiations(data || []);
    } catch (error) {
      console.error('Error loading negotiations:', error);
    } finally {
      setLoading(false);
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
        description="Acompanhe cada oportunidade pelo cliente, veículo, prioridade e proxima etapa de venda."
        action={(
          <Button size="lg" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Nova negociação
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Pipeline ativo" value={summary.active} description="Conversas em andamento" icon={Handshake} accent />
        <MetricCard title="Alta prioridade" value={summary.highPriority} description="Precisam de ação rapida" icon={UserRound} />
        <MetricCard title="Finalizadas" value={summary.closed} description="Negocios ganhos" icon={CalendarDays} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou veículo"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative sm:w-72">
            <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="pl-10">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="primeiro_contato">Primeiro contato</SelectItem>
                <SelectItem value="avaliação">Avaliação</SelectItem>
                <SelectItem value="test_drive_agendado">Test drive agendado</SelectItem>
                <SelectItem value="test_drive_realizado">Test drive realizado</SelectItem>
                <SelectItem value="proposta_enviada">Proposta enviada</SelectItem>
                <SelectItem value="negociação_preço">Negociação de preço</SelectItem>
                <SelectItem value="aprovação_credito">Aprovação de credito</SelectItem>
                <SelectItem value="documentação">Documentação</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredNegotiations.length === 0 ? (
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
        <div className="grid gap-4 xl:grid-cols-2">
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
                        <p className="text-sm text-muted-foreground">{negotiation.client_phone}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={stageVariant(negotiation.stage)}>
                        {stageLabels[negotiation.stage] ?? negotiation.stage}
                      </Badge>
                      <Badge variant={p.variant}>{p.label}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Veiculo</p>
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

      {showForm && (
        <NegotiationForm onClose={() => {
          setShowForm(false);
          loadNegotiations();
        }} />
      )}
    </div>
  );
}



