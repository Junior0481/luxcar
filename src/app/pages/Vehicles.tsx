import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase, Vehicle } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Plus, Search, Filter, Car, Edit, Trash2 } from "lucide-react";
import { VehicleForm } from "../components/VehicleForm";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  disponivel: { label: "Disponível", variant: "default" },
  em_negociacao: { label: "Em Negociação", variant: "secondary" },
  vendido: { label: "Vendido", variant: "outline" },
};

export function Vehicles() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "administrador";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    filterVehicles();
  }, [searchTerm, statusFilter, vehicles]);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error("Error loading vehicles:", error);
    } finally {
      setLoading(false);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este veículo?")) return;

    try {
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .eq("vehicle_id", id)
        .limit(1);

      if (sales && sales.length > 0) {
        alert("Não é possível excluir: este veículo já possui vendas registradas.");
        return;
      }

      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;

      loadVehicles();
    } catch (error: any) {
      alert("Erro ao excluir veículo: " + error.message);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingVehicle(null);
    loadVehicles();
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Veículos</h1>
          <p className="text-muted-foreground mt-1">Gerencie o estoque de veículos</p>
        </div>

        {isAdmin && (
          <Button size="lg" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Novo Veículo
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por marca, modelo ou ano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 pl-10 pr-8 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              <option value="all">Todos os status</option>
              <option value="disponivel">Disponível</option>
              <option value="em_negociacao">Em Negociação</option>
              <option value="vendido">Vendido</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {filteredVehicles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum veículo encontrado</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm || statusFilter !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Comece cadastrando seu primeiro veículo"}
            </p>
            {!searchTerm && statusFilter === "all" && isAdmin && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" />
                Cadastrar Veículo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => {
            const b = statusBadge[vehicle.status] ?? statusBadge.disponivel;
            return (
              <Card key={vehicle.id} className="overflow-hidden pt-0 gap-0 transition-shadow hover:shadow-md">
                <div className="h-48 bg-gradient-to-br from-muted to-accent flex items-center justify-center overflow-hidden">
                  {vehicle.images && vehicle.images.length > 0 ? (
                    <img
                      src={vehicle.images[0]}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Car className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {vehicle.brand} {vehicle.model}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {vehicle.year}
                        {vehicle.version ? ` • ${vehicle.version}` : ""}
                      </p>
                    </div>
                    <Badge variant={b.variant}>{b.label}</Badge>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Compra:</span>
                      <span className="font-medium text-foreground">{brl(vehicle.purchase_price)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Venda:</span>
                      <span className="font-semibold text-primary">{brl(vehicle.sale_price)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button asChild variant="secondary" size="sm" className="flex-1">
                      <Link to={`/dashboard/vehicles/${vehicle.id}`}>Detalhes</Link>
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleEdit(vehicle)} aria-label="Editar">
                      <Edit className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(vehicle.id)}
                        aria-label="Excluir"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && <VehicleForm vehicle={editingVehicle} onClose={handleFormClose} />}
    </div>
  );
}
