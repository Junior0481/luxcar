import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Negotiation, Vehicle, Profile } from '../../lib/supabase';
import { Plus, Search, Filter, Handshake } from 'lucide-react';
import { NegotiationForm } from '../components/NegotiationForm';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';

type NegotiationWithDetails = Negotiation & {
  vehicle?: Vehicle;
  seller?: Profile;
};

const stageLabels: Record<string, string> = {
  primeiro_contato: 'Primeiro Contato',
  avaliacao: 'Avaliação',
  test_drive_agendado: 'Test Drive Agendado',
  test_drive_realizado: 'Test Drive Realizado',
  proposta_enviada: 'Proposta Enviada',
  negociacao_preco: 'Negociação Preço',
  aprovacao_credito: 'Aprovação Crédito',
  documentacao: 'Documentação',
  finalizado: 'Finalizado',
  perdido: 'Perdido'
};

const stageVariant = (stage: string): 'default' | 'secondary' | 'outline' | 'destructive' =>
  stage === 'finalizado' ? 'default' : stage === 'perdido' ? 'destructive' : 'secondary';

const priorityMeta: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' }> = {
  alta: { label: 'Alta', variant: 'destructive' },
  media: { label: 'Média', variant: 'default' },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Negociações</h1>
          <p className="text-muted-foreground mt-1">Acompanhe todas as negociações em andamento</p>
        </div>
        <Button size="lg" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Nova Negociação
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por cliente ou veículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-9 pl-10 pr-8 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              <option value="active">Ativas</option>
              <option value="all">Todas</option>
              <option value="primeiro_contato">Primeiro Contato</option>
              <option value="avaliacao">Avaliação</option>
              <option value="test_drive_agendado">Test Drive Agendado</option>
              <option value="test_drive_realizado">Test Drive Realizado</option>
              <option value="proposta_enviada">Proposta Enviada</option>
              <option value="negociacao_preco">Negociação Preço</option>
              <option value="aprovacao_credito">Aprovação Crédito</option>
              <option value="documentacao">Documentação</option>
              <option value="finalizado">Finalizado</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {filteredNegotiations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Handshake className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma negociação encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm || stageFilter !== 'active'
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando sua primeira negociação'}
            </p>
            {!searchTerm && stageFilter === 'active' && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" />
                Nova Negociação
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNegotiations.map((negotiation) => {
                  const p = priorityMeta[negotiation.priority] ?? priorityMeta.media;
                  return (
                    <TableRow key={negotiation.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{negotiation.client_name}</p>
                        {negotiation.client_phone && (
                          <p className="text-sm text-muted-foreground">{negotiation.client_phone}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {negotiation.vehicle ? (
                          <>
                            <p className="font-medium text-foreground">
                              {negotiation.vehicle.brand} {negotiation.vehicle.model}
                            </p>
                            <p className="text-sm text-muted-foreground">{negotiation.vehicle.year}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">{negotiation.seller?.full_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={stageVariant(negotiation.stage)}>
                          {stageLabels[negotiation.stage] ?? negotiation.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.variant}>{p.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(negotiation.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/dashboard/negotiations/${negotiation.id}`}
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          Ver detalhes
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
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
