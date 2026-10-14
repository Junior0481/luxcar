import { useEffect, useMemo, useState } from 'react';
import { supabase, Lead, Vehicle, Profile } from '../../lib/supabase';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertCircle,
  Filter,
  Handshake,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
} from 'lucide-react';
import { ManualLeadForm } from '../components/ManualLeadForm';
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
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { formatPhone } from '../../lib/format';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

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
  contacted: 'outline',
  qualified: 'outline',
  converted: 'outline',
  lost: 'destructive',
};

const getSourceLabel = (source?: string | null): string => {
  if (!source) return 'Não informada';
  const normalized = source.trim().toLowerCase();
  if (normalized === 'website') return 'Site';
  if (normalized === 'manual') return 'Manual';
  return source;
};

export function Leads() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithDetails | null>(null);
  const [convertingLead, setConvertingLead] = useState<LeadWithDetails | null>(null);

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
      result = result.filter(
        (item) => (item.source || '').trim().toLowerCase() === sourceFilter.toLowerCase()
      );
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

      <section aria-label="Resumo dos leads" className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
        {[
          { title: 'Total de leads', value: summary.total, note: 'Contatos registrados' },
          { title: 'Novos contatos', value: summary.novos, note: 'Aguardando primeiro contato' },
          { title: 'Em atendimento', value: summary.emAtendimento, note: 'Em contato ou qualificados' },
          { title: 'Convertidos', value: summary.convertidos, note: 'Viraram negociações/vendas' },
        ].map((item) => <div key={item.title} className="border-b border-r border-border px-4 py-3 last:border-r-0 sm:border-b-0 sm:px-5"><p className="text-xs text-muted-foreground">{item.title}</p><p className="mt-1 text-2xl font-bold tabular-nums text-foreground [font-family:var(--font-display)]">{item.value}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p></div>)}
      </section>

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
                <SelectItem value="manual">Manual</SelectItem>
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
            const vBadge = statusVariant[lead.status] || 'outline';
            const sLabel = statusLabels[lead.status] || lead.status;
            const srcLabel = getSourceLabel(lead.source);

            return (
              <button
                type="button"
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                aria-label={`Ver detalhes do lead de ${lead.customer_name}`}
                className="lux-card-hover w-full rounded-xl border border-border bg-card p-0 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
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
                            {formatPhone(lead.customer_phone)}
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
              </button>
            );
          })}
        </div>
      )}

      <ManualLeadForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => loadLeads({ silent: true })}
      />

      <NegotiationForm
        open={convertingLead !== null}
        lead={convertingLead}
        onClose={() => {
          setConvertingLead(null);
          loadLeads({ silent: true });
        }}
        onCreated={(negotiationId) => navigate(`/dashboard/negotiations/${negotiationId}`)}
      />

      <Dialog open={selectedLead !== null} onOpenChange={(open) => { if (!open) setSelectedLead(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedLead && (
            <>
              <DialogHeader className="pr-8">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant[selectedLead.status] || 'outline'}>
                    {statusLabels[selectedLead.status] || selectedLead.status}
                  </Badge>
                  <Badge variant="outline">{getSourceLabel(selectedLead.source)}</Badge>
                </div>
                <DialogTitle className="text-2xl">{selectedLead.customer_name}</DialogTitle>
                <DialogDescription>
                  Lead cadastrado em {new Date(selectedLead.created_at).toLocaleString('pt-BR')}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-3 font-semibold text-foreground">Contato</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="mt-1 font-medium text-foreground">{selectedLead.customer_phone ? formatPhone(selectedLead.customer_phone) : 'Não informado'}</p>
                      {selectedLead.customer_phone && <a href={`https://wa.me/55${selectedLead.customer_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#0F3B23] px-3 py-2 text-sm font-semibold text-[#8BF0BA] hover:bg-[#14512F]"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp</a>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <p className="mt-1 break-all font-medium text-foreground">{selectedLead.customer_email || 'Não informado'}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-3 font-semibold text-foreground">Atendimento</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Vendedor responsável</p>
                      <p className="mt-1 font-medium text-foreground">{selectedLead.assigned?.full_name || 'Não atribuído'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Última atualização</p>
                      <p className="mt-1 font-medium text-foreground">{new Date(selectedLead.updated_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4 sm:col-span-2">
                  <h3 className="mb-2 font-semibold text-foreground">Veículo de interesse</h3>
                  {selectedLead.vehicle ? (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-foreground">
                        {selectedLead.vehicle.brand} {selectedLead.vehicle.model}
                        {selectedLead.vehicle.version ? ` ${selectedLead.vehicle.version}` : ''}
                      </p>
                      <p className="text-muted-foreground">
                        {selectedLead.vehicle.year}
                        {selectedLead.vehicle.sale_price ? ` · ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(selectedLead.vehicle.sale_price))}` : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Interesse geral, sem veículo específico.</p>
                  )}
                </div>
                <div className="rounded-xl border border-border p-4 sm:col-span-2">
                  <h3 className="mb-2 font-semibold text-foreground">Mensagem / observações</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {selectedLead.message || 'Nenhuma mensagem ou observação cadastrada.'}
                  </p>
                </div>
              </div>
              {selectedLead.status !== 'converted' && selectedLead.status !== 'lost' && (
                <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Ao escalar, os dados do cliente serão levados para uma nova negociação.
                  </p>
                  <Button
                    onClick={() => {
                      setConvertingLead(selectedLead);
                      setSelectedLead(null);
                    }}
                  >
                    <Handshake className="size-4" />
                    Escalar para negociação
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
