import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase, Vehicle } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { AlertCircle, Car, Edit, Filter, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { VehicleForm } from "../components/VehicleForm";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { PageHeader } from "../components/ui/page-header";
import { Skeleton } from "../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select";
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

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  disponivel: { label: "Disponível", variant: "default" },
  em_negociacao: { label: "Em negociação", variant: "outline" },
  vendido: { label: "Vendido", variant: "outline" },
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
          v.year.toString().includes(searchTerm),
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
        eyebrow="Vitrine operacional"
        title="Estoque da loja"
        description="Veja o que está pronto para vender, o que está em negociação e onde está o capital da loja."
        action={isAdmin ? (
          <Button size="lg" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Adicionar veículo
          </Button>
        ) : null}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar por marca, modelo ou ano"
              placeholder="Buscar por marca, modelo ou ano"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative sm:w-64">
            <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="pl-10" aria-label="Filtrar por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="em_negociacao">Em negociação</SelectItem>
                <SelectItem value="vendido">Vendido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const b = statusBadge[vehicle.status] ?? statusBadge.disponivel;
            const margin = Number(vehicle.sale_price || 0) - Number(vehicle.purchase_price || 0);

            return (
              <Card key={vehicle.id} className="group gap-0 overflow-hidden pt-0 lux-card-hover">
                <div className="relative h-56 overflow-hidden">
                  {vehicle.images && vehicle.images.length > 0 ? (
                    <img
                      src={vehicle.images[0]}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <div className="flex size-20 items-center justify-center rounded-3xl bg-accent text-primary">
                        <Car className="size-10" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />
                  <div className="absolute right-3 top-3">
                    <Badge variant={b.variant} className="shadow-lux-sm backdrop-blur-md">{b.label}</Badge>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="truncate text-lg font-medium text-white">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    <p className="truncate text-sm text-white/75">
                      {vehicle.year}
                      {vehicle.version ? ` - ${vehicle.version}` : ""}
                    </p>
                  </div>
                </div>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Preço de venda</p>
                      <p className="text-2xl font-medium leading-tight text-foreground">{brl(vehicle.sale_price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Margem estimada</p>
                      <p className={margin >= 0 ? "text-sm font-medium text-primary" : "text-sm font-medium text-destructive"}>
                        {brl(margin)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                    Compra: <span className="font-medium text-foreground">{brl(vehicle.purchase_price)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="secondary" size="sm" className="flex-1 min-w-0">
                      <Link to={`/dashboard/vehicles/${vehicle.id}`} className="truncate">Ver ficha</Link>
                    </Button>
                    {isAdmin && (
                      <Button variant="outline" size="icon" onClick={() => handleEdit(vehicle)} aria-label="Editar veículo" className="shrink-0">
                        <Edit className="size-4" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setVehicleToDelete(vehicle)}
                        aria-label="Excluir veículo"
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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



