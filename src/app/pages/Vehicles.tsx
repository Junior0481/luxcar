import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase, Vehicle } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { AlertCircle, Car, Edit, Image as ImageIcon, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { VehicleForm } from "../components/VehicleForm";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { PageHeader } from "../components/ui/page-header";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { formatFuel, formatPercent, pluralize } from "../../lib/format";
import { thumbUrl } from "../../services/storage.service";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusBadge: Record<string, { label: string; className: string; dot: string }> = {
  disponivel: { label: "Disponível", className: "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-status-success", dot: "bg-[var(--status-success-dot)]" },
  em_negociacao: { label: "Em negociação", className: "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-status-warning", dot: "bg-status-warning" },
  vendido: { label: "Vendido", className: "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-status-info", dot: "bg-status-info" },
};

export function Vehicles() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "administrador";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (profile?.company_id) loadVehicles();
  }, [profile?.company_id]);

  useEffect(() => {
    filterVehicles();
  }, [searchTerm, statusFilter, vehicles]);

  const loadVehicles = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("company_id", profile!.company_id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (err: any) {
      console.error("Error loading vehicles:", err);
      const text = err?.message || "Erro ao carregar veículos.";
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

  const filterVehicles = () => {
    let filtered = vehicles;

    if (searchTerm) {
      filtered = filtered.filter(
        (v) =>
          v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.year.toString().includes(searchTerm) ||
          (v.plate || "").toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }

    setFilteredVehicles(filtered);
  };

  const confirmDelete = async () => {
    if (!vehicleToDelete) return;
    const id = vehicleToDelete.id;

    try {
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .eq("vehicle_id", id)
        .limit(1);

      if (sales && sales.length > 0) {
        toast.error("Não é possível excluir: este veículo já possui vendas registradas.");
        setVehicleToDelete(null);
        return;
      }

      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;

      toast.success("Veículo excluído com sucesso.");
      loadVehicles({ silent: true });
    } catch (error: any) {
      toast.error("Erro ao excluir veículo: " + (error.message || "Erro desconhecido"));
    } finally {
      setVehicleToDelete(null);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingVehicle(null);
    loadVehicles({ silent: true });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-20" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Car}
        title="Estoque"
        description={`${pluralize(vehicles.length, 'veículo', 'veículos')} · ${brl(vehicles.reduce((sum, vehicle) => sum + Number(vehicle.sale_price || 0), 0))} em estoque a preço de venda`}
        action={isAdmin ? (
          <Button size="lg" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Adicionar veículo
          </Button>
        ) : null}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filtrar veículos por status" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {[{ value: "all", label: "Todos" }, { value: "disponivel", label: "Disponível" }, { value: "em_negociacao", label: "Em negociação" }, { value: "vendido", label: "Vendido" }].map((tab) => {
            const count = tab.value === "all" ? vehicles.length : vehicles.filter((vehicle) => vehicle.status === tab.value).length;
            const active = statusFilter === tab.value;
            return <button key={tab.value} type="button" role="tab" aria-selected={active} onClick={() => setStatusFilter(tab.value)} className={`h-[34px] rounded-lg px-3 text-[13px] transition-colors ${active ? "bg-sidebar-accent font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{tab.label} <span className="tabular-nums opacity-70">{count}</span></button>;
          })}
        </div>
        <div className="relative w-full sm:w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar por marca, modelo, ano ou placa"
              placeholder="Buscar por marca, modelo, ano ou placa"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar estoque</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadVehicles()} className="w-fit">
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <EmptyState
          title="Nenhum veículo encontrado"
          description={
            searchTerm || statusFilter !== "all"
              ? "Ajuste os filtros para encontrar o carro certo no estoque."
              : "Adicione o primeiro veículo e comece a organizar sua vitrine comercial."
          }
          action={
            !searchTerm && statusFilter === "all" && isAdmin ? (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                Adicionar veículo
              </Button>
            ) : null
          }
        />
      ) : (
        <Table className="min-w-[900px] text-[13px]">
          <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Placa</TableHead><TableHead className="text-right">Km</TableHead><TableHead className="text-right">Preço de venda</TableHead><TableHead className="text-right">Margem</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Em estoque</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredVehicles.map((vehicle) => {
              const badge = statusBadge[vehicle.status] ?? statusBadge.disponivel;
              const margin = Number(vehicle.sale_price || 0) - Number(vehicle.purchase_price || 0);
              const marginPct = Number(vehicle.purchase_price) ? (margin / Number(vehicle.purchase_price)) * 100 : 0;
              const daysInStock = Math.max(0, Math.floor((Date.now() - new Date(vehicle.created_at).getTime()) / 86400000));
              return <TableRow key={vehicle.id}>
                <TableCell><Link to={`/dashboard/vehicles/${vehicle.id}`} className="flex items-center gap-3 text-foreground hover:text-primary">
                  {vehicle.images?.[0] ? <img src={thumbUrl(vehicle.images[0])} alt="" loading="lazy" className="size-[72px] h-12 shrink-0 rounded-md object-cover" /> : <span className="flex h-12 w-[72px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><ImageIcon className="size-5" /></span>}
                  <span className="flex min-w-0 flex-col"><span className="truncate text-sm font-semibold">{vehicle.brand} {vehicle.model}</span><span className="truncate text-muted-foreground">{[vehicle.version, vehicle.year, vehicle.fuel_type ? formatFuel(vehicle.fuel_type) : null].filter(Boolean).join(" · ")}</span></span>
                </Link></TableCell>
                <TableCell>{vehicle.plate ? <span className="rounded-sm bg-[#F2F3F0] px-1.5 py-0.5 font-license-plate text-sm font-bold tracking-wider text-[#111317]">{vehicle.plate}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{Number(vehicle.mileage || 0).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{brl(Number(vehicle.sale_price))}</TableCell>
                <TableCell className={`text-right font-semibold tabular-nums ${margin < 0 ? "text-status-danger" : "text-status-success"}`}>{formatPercent(marginPct)}</TableCell>
                <TableCell><Badge variant="outline" className={`gap-1.5 rounded-full px-[9px] py-[3px] text-xs font-semibold ${badge.className}`}><span className={`size-1.5 rounded-full ${badge.dot}`} />{badge.label}</Badge></TableCell>
                <TableCell className={`text-right tabular-nums ${daysInStock > 60 ? "font-semibold text-status-warning" : "text-foreground"}`}>{daysInStock} dias</TableCell>
                <TableCell><div className="flex items-center justify-end gap-1"><Button asChild variant="ghost" size="sm"><Link to={`/dashboard/vehicles/${vehicle.id}`}>Ver ficha</Link></Button>{isAdmin && <Button variant="ghost" size="icon" onClick={() => handleEdit(vehicle)} aria-label="Editar veículo"><Edit className="size-4" /></Button>}{isAdmin && <Button variant="ghost" size="icon" onClick={() => setVehicleToDelete(vehicle)} aria-label="Excluir veículo" className="text-destructive"><Trash2 className="size-4" /></Button>}</div></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      )}

      <VehicleForm open={showForm} vehicle={editingVehicle} onClose={handleFormClose} />

      <AlertDialog open={!!vehicleToDelete} onOpenChange={(open) => { if (!open) setVehicleToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O veículo {vehicleToDelete ? `"${vehicleToDelete.brand} ${vehicleToDelete.model}"` : ''} será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



