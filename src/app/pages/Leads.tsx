import { useEffect, useMemo, useState } from 'react';
import { supabase, Lead, Vehicle, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertCircle,
  CalendarDays,
  Filter,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { ManualLeadForm } from '../components/ManualLeadForm';
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
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';

type LeadWithDetails = Lead & {
  vehicle?: Vehicle | null;
  assigned?: Profile | null;
};

const statusLabels: Record<string, string> = {
  new: 'Novo',
  contacted: 'Em contato',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost: 'Perdido',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  new: 'default',
  contacted: 'secondary',
  qualified: 'secondary',
  converted: 'outline',
  lost: 'destructive',
};

const sourceLabels: Record<string, string> = {
  manual: 'Manual (Loja)',
  website: 'Site',
};

export function Leads() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (profile?.company_id) {
      loadLeads();
    }
  }, [profile?.company_id]);

  useEffect(() => {
    filterLeads();
  }, [searchTerm, statusFilter, sourceFilter, leads]);

  const loadLeads = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const { data, error: err } = await supabase
        .from('leads')
        .select(`
          *,
          vehicle:vehicles(*),
          assigned:profiles(*)
        `)
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setLeads((data as LeadWithDetails[]) || []);
    } catch (err: any) {
      console.error('Error loading leads:', err);
      const text = err?.message || 'Erro ao carregar leads.';
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

  const filterLeads = () => {
    let result = leads;

    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    if (sourceFilter !== 'all') {
      result = result.filter((item) => item.source === sourceFilter);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.customer_name.toLowerCase().includes(q) ||
          item.customer_email?.toLowerCase().includes(q) ||
          item.customer_phone?.includes(searchTerm) ||
          item.vehicle?.brand.toLowerCase().includes(q) ||
          item.vehicle?.model.toLowerCase().includes(q)
      );
    }

    setFilteredLeads(result);
  };

  const summary = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter((l) => l.status === 'new').length;
    const emAtendimento = leads.filter((l) => ['contacted', 'qualified'].includes(l.status)).length;
    const convertidos = leads.filter((l) => l.status === 'converted').length;
    return { total, novos, emAtendimento, convertidos };
  }, [leads]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Skeleton className="h-32" />
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
        icon={UserPlus}
        eyebrow="Atendimento e captação"
        title="Leads"
        description="Acompanhe os clientes potenciais recebidos pelo site ou cadastrados pela equipe na loja."
        action={(
          <Button size="lg" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Novo lead
          </Button>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard
          title="Total de leads"
          value={summary.total}
          description="Contatos registrados"
          icon={Users}
          accent
        />
        <MetricCard
          title="Novos contatos"
          value={summary.novos}
          description="Aguardando primeiro contato"
          icon={UserPlus}
        />
        <MetricCard
          title="Em atendimento"
          value={summary.emAtendimento}
          description="Em contato ou qualificados"
          icon={UserCheck}
        />
        <MetricCard
          title="Convertidos"
          value={summary.convertidos}
          description="Viraram negociações/vendas"
          icon={CalendarDays}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar por cliente, contato ou veículo"
              placeholder="Buscar por cliente, contato ou veículo"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative sm:w-56">
            <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="pl-10" aria-label="Filtrar por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="contacted">Em contato</SelectItem>
                <SelectItem value="qualified">Qualificado</SelectItem>
                <SelectItem value="converted">Convertido</SelectItem>
                <SelectItem value="lost">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative sm:w-48">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger aria-label="Filtrar por origem">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="manual">Manual (Loja)</SelectItem>
                <SelectItem value="website">Site</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar leads</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLeads()}
            className="w-fit"
          >
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : filteredLeads.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nenhum lead encontrado"
          description={
            searchTerm || statusFilter !== 'all' || sourceFilter !== 'all'
              ? 'Ajuste os filtros de busca para encontrar o contato desejado.'
              : 'Cadastre o primeiro lead manualmente ou aguarde contatos recebidos pelo catálogo público da loja.'
          }
          action={
            !searchTerm && statusFilter === 'all' && sourceFilter === 'all' ? (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                Novo lead
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredLeads.map((lead) => {
            const vBadge = statusVariant[lead.status] || 'secondary';
            const sLabel = statusLabels[lead.status] || lead.status;
            const srcLabel = sourceLabels[lead.source] || lead.source;

            return (
              <Card key={lead.id} className="lux-card-hover">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <h3 className="truncate text-lg font-medium text-foreground">
                        {lead.customer_name}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {lead.customer_phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="size-3.5" />
                            {lead.customer_phone}
                          </span>
                        )}
                        {lead.customer_email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="size-3.5" />
                            {lead.customer_email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={vBadge}>{sLabel}</Badge>
                      <Badge variant="outline">{srcLabel}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Veículo</p>
                      <p className="font-medium text-foreground truncate">
                        {lead.vehicle
                          ? `${lead.vehicle.brand} ${lead.vehicle.model}`
                          : 'Interesse geral'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Responsável</p>
                      <p className="font-medium text-foreground truncate">
                        {lead.assigned?.full_name || 'Não atribuído'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data</p>
                      <p className="font-medium text-foreground">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {lead.message && (
                    <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80 mb-1">
                        Observação
                      </p>
                      <p className="line-clamp-2 text-foreground/90 whitespace-pre-wrap">
                        {lead.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ManualLeadForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => loadLeads({ silent: true })}
      />
    </div>
  );
}
