import { useState, useEffect } from "react";
import { supabase, Vehicle } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { X, AlertCircle, Upload, Trash2 } from "lucide-react";
import { FipeSearch } from "./FipeSearch";
import { CAR_BRANDS } from "../../constants/carBrands";

type VehicleFormProps = {
  vehicle?: Vehicle | null;
  onClose: () => void;
};

export function VehicleForm({
  vehicle,
  onClose,
}: VehicleFormProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    version: "",
    purchase_price: "",
    sale_price: "",
    fipe_code: "",
    images: [] as string[],
    status: "disponivel" as
      | "disponivel"
      | "em_negociacao"
      | "vendido",
    color: "",
    plate: "",
    mileage: "",
    fuel_type: "",
    transmission: "",
    description: "",
  });

  useEffect(() => {
    if (vehicle) {
      setFormData({
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        version: vehicle.version || "",
        purchase_price: vehicle.purchase_price.toString(),
        sale_price: vehicle.sale_price.toString(),
        fipe_code: vehicle.fipe_code || "",
        status: vehicle.status,
        color: vehicle.color || "",
        plate: vehicle.plate || "",
        mileage: vehicle.mileage?.toString() || "",
        fuel_type: vehicle.fuel_type || "",
        transmission: vehicle.transmission || "",
        description: vehicle.description || "",
      });
      if (vehicle.images) {
        setImageUrls(vehicle.images);
      }
    }
  }, [vehicle]);

  const formatPlate = (value: string): string => {
    // Remove caracteres não alfanuméricos
    let cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    // Formata no padrão Mercosul: ABC-1D23 ou antigo ABC-1234
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
    }
  };

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPlate(e.target.value);
    setFormData({ ...formData, plate: formatted });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrls((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFipeValue = (value: number, fipeCode: string) => {
    setFormData({
      ...formData,
      sale_price: value.toString(),
      fipe_code: fipeCode,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const vehicleData = {
        company_id: profile?.company_id || null,
        brand: formData.brand,
        model: formData.model,
        year: formData.year,
        version: formData.version || null,
        purchase_price: parseFloat(formData.purchase_price),
        sale_price: parseFloat(formData.sale_price),
        images: imageUrls,
        fipe_code: formData.fipe_code || null,
        status: formData.status,
        color: formData.color || null,
        plate: formData.plate || null,
        mileage: formData.mileage
          ? parseInt(formData.mileage)
          : null,
        fuel_type: formData.fuel_type || null,
        transmission: formData.transmission || null,
        description: formData.description || null,
        created_by: user?.id,
      };

      if (vehicle) {
        const { error } = await supabase
          .from("vehicles")
          .update(vehicleData)
          .eq("id", vehicle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vehicles")
          .insert([vehicleData]);
        if (error) throw error;
      }

      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar veículo");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {vehicle
              ? "Editar Veículo"
              : "Cadastrar Novo Veículo"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div>
              <label
                htmlFor="brand"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Marca *
              </label>
              <select
                id="brand"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione a marca...</option>
                {CAR_BRANDS.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="model"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Modelo *
              </label>
              <input
                type="text"
                id="model"
                name="model"
                value={formData.model}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Corolla, Civic, Fiesta..."
              />
            </div>

            <div>
              <label
                htmlFor="year"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Ano *
              </label>
              <input
                type="number"
                id="year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="version"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Versão
              </label>
              <input
                type="text"
                id="version"
                name="version"
                value={formData.version}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="XEi, EXL, SE..."
              />
            </div>

            <div>
              <label
                htmlFor="purchase_price"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Valor de Compra (R$) *
              </label>
              <input
                type="number"
                id="purchase_price"
                name="purchase_price"
                value={formData.purchase_price}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="50000.00"
              />
            </div>

            <div>
              <label
                htmlFor="sale_price"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Valor de Venda (R$) *
              </label>
              <input
                type="number"
                id="sale_price"
                name="sale_price"
                value={formData.sale_price}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="60000.00"
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Status *
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="disponivel">Disponível</option>
                <option value="em_negociacao">
                  Em Negociação
                </option>
                <option value="vendido">Vendido</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="color"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Cor
              </label>
              <input
                type="text"
                id="color"
                name="color"
                value={formData.color}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Preto, Branco, Prata..."
              />
            </div>

            <div>
              <label
                htmlFor="plate"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Placa
              </label>
              <input
                type="text"
                id="plate"
                name="plate"
                value={formData.plate}
                onChange={handlePlateChange}
                maxLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                placeholder="ABC-1D23"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formato: ABC-1234 ou ABC-1D23 (Mercosul)
              </p>
            </div>

            <div>
              <label
                htmlFor="mileage"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Quilometragem (km)
              </label>
              <input
                type="number"
                id="mileage"
                name="mileage"
                value={formData.mileage}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="50000"
              />
            </div>

            <div>
              <label
                htmlFor="fuel_type"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Combustível
              </label>
              <select
                id="fuel_type"
                name="fuel_type"
                value={formData.fuel_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione...</option>
                <option value="gasolina">Gasolina</option>
                <option value="etanol">Etanol</option>
                <option value="flex">Flex</option>
                <option value="diesel">Diesel</option>
                <option value="eletrico">Elétrico</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="transmission"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Transmissão
              </label>
              <select
                id="transmission"
                name="transmission"
                value={formData.transmission}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione...</option>
                <option value="manual">Manual</option>
                <option value="automatica">Automática</option>
                <option value="automatizada">
                  Automatizada
                </option>
                <option value="cvt">CVT</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <FipeSearch onValueFound={handleFipeValue} />
          </div>

          <div className="border border-gray-200 rounded-2xl bg-gray-50 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Fotos do Veículo
            </label>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-white hover:border-blue-400 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Selecionar Fotos
              </label>
              <p className="text-sm text-gray-500 mt-3">
                PNG, JPG ou WEBP (máx. 5MB cada)
              </p>
            </div>

            {imageUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Informações adicionais sobre o veículo..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? "Salvando..."
                : vehicle
                  ? "Atualizar"
                  : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}