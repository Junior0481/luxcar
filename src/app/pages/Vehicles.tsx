import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase, Vehicle } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  Plus,
  Search,
  Filter,
  Car,
  AlertCircle,
  Edit,
  Trash2,
} from "lucide-react";
import { VehicleForm } from "../components/VehicleForm";

export function Vehicles() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "administrador";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<
    Vehicle[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] =
    useState<Vehicle | null>(null);

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
          v.brand
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          v.model
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          v.year.toString().includes(searchTerm),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (v) => v.status === statusFilter,
      );
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

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", id);

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

  const getStatusBadge = (status: string) => {
    const badges = {
      disponivel: {
        label: "Disponível",
        className: "bg-[#fff2df] text-[#010101]",
      },
      em_negociacao: {
        label: "Em Negociação",
        className: "bg-[#efefef] text-[#555459]",
      },
      vendido: {
        label: "Vendido",
        className: "bg-[#010101] text-white",
      },
    };
    const badge =
      badges[status as keyof typeof badges] ||
      badges.disponivel;
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}
      >
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Veículos
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie o estoque de veículos
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Veículo
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo ou ano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Todos os status</option>
              <option value="disponivel">Disponível</option>
              <option value="em_negociacao">
                Em Negociação
              </option>
              <option value="vendido">Vendido</option>
            </select>
          </div>
        </div>
      </div>

      {filteredVehicles.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
          <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhum veículo encontrado
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || statusFilter !== "all"
              ? "Tente ajustar os filtros de busca"
              : "Comece cadastrando seu primeiro veículo"}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Cadastrar Veículo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
                {vehicle.images && vehicle.images.length > 0 ? (
                  <img
                    src={vehicle.images[0]}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Car className="w-16 h-16 text-gray-400" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {vehicle.year} • {vehicle.version}
                    </p>
                  </div>
                  {getStatusBadge(vehicle.status)}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      Compra:
                    </span>
                    <span className="font-medium text-gray-900">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(vehicle.purchase_price)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Venda:
                    </span>
                    <span className="font-semibold text-blue-600">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(vehicle.sale_price)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    to={`/dashboard/vehicles/${vehicle.id}`}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors text-center"
                  >
                    Detalhes
                  </Link>
                  <button
                    onClick={() => handleEdit(vehicle)}
                    className="px-3 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {profile?.role === "administrador" && (
                    <button
                      onClick={() => handleDelete(vehicle.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <VehicleForm
          vehicle={editingVehicle}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
