import { useState, useEffect } from "react";
import { supabase, Vehicle } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { X, AlertCircle, Upload, Trash2 } from "lucide-react";
import { FipeSearch } from "./FipeSearch";
import { CAR_BRANDS } from "../../constants/carBrands";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type VehicleFormProps = {
  vehicle?: Vehicle | null;
  onClose: () => void;
};

const selectClass =
  "w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function VehicleForm({ vehicle, onClose }: VehicleFormProps) {
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
    status: "disponivel" as "disponivel" | "em_negociacao" | "vendido",
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
        images: vehicle.images || [],
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
    let cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
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
        mileage: formData.mileage ? parseInt(formData.mileage) : null,
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-7xl h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-2xl font-bold text-foreground">
            {vehicle ? "Editar Veículo" : "Cadastrar Novo Veículo"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca *</Label>
              <select id="brand" name="brand" value={formData.brand} onChange={handleChange} required className={selectClass}>
                <option value="">Selecione a marca...</option>
                {CAR_BRANDS.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input id="model" name="model" value={formData.model} onChange={handleChange} required placeholder="Corolla, Civic, Fiesta..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Ano *</Label>
              <Input type="number" id="year" name="year" value={formData.year} onChange={handleChange} required min="1900" max={new Date().getFullYear() + 1} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">Versão</Label>
              <Input id="version" name="version" value={formData.version} onChange={handleChange} placeholder="XEi, EXL, SE..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_price">Valor de Compra (R$) *</Label>
              <Input type="number" id="purchase_price" name="purchase_price" value={formData.purchase_price} onChange={handleChange} required step="0.01" min="0" placeholder="50000.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale_price">Valor de Venda (R$) *</Label>
              <Input type="number" id="sale_price" name="sale_price" value={formData.sale_price} onChange={handleChange} required step="0.01" min="0" placeholder="60000.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select id="status" name="status" value={formData.status} onChange={handleChange} className={selectClass}>
                <option value="disponivel">Disponível</option>
                <option value="em_negociacao">Em Negociação</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input id="color" name="color" value={formData.color} onChange={handleChange} placeholder="Preto, Branco, Prata..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plate">Placa</Label>
              <Input id="plate" name="plate" value={formData.plate} onChange={handlePlateChange} maxLength={8} className="uppercase" placeholder="ABC-1D23" />
              <p className="text-xs text-muted-foreground">Formato: ABC-1234 ou ABC-1D23 (Mercosul)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mileage">Quilometragem (km)</Label>
              <Input type="number" id="mileage" name="mileage" value={formData.mileage} onChange={handleChange} min="0" placeholder="50000" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fuel_type">Combustível</Label>
              <select id="fuel_type" name="fuel_type" value={formData.fuel_type} onChange={handleChange} className={selectClass}>
                <option value="">Selecione...</option>
                <option value="gasolina">Gasolina</option>
                <option value="etanol">Etanol</option>
                <option value="flex">Flex</option>
                <option value="diesel">Diesel</option>
                <option value="eletrico">Elétrico</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transmission">Transmissão</Label>
              <select id="transmission" name="transmission" value={formData.transmission} onChange={handleChange} className={selectClass}>
                <option value="">Selecione...</option>
                <option value="manual">Manual</option>
                <option value="automatica">Automática</option>
                <option value="automatizada">Automatizada</option>
                <option value="cvt">CVT</option>
              </select>
            </div>
          </div>

          <FipeSearch onValueFound={handleFipeValue} />

          <div className="border border-border rounded-2xl bg-muted p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Fotos do Veículo</p>

            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-card hover:border-primary transition-colors">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <input type="file" id="image-upload" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              <label
                htmlFor="image-upload"
                className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Selecionar Fotos
              </label>
              <p className="text-sm text-muted-foreground mt-3">PNG, JPG ou WEBP (máx. 5MB cada)</p>
            </div>

            {imageUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img src={url} alt={`Foto ${index + 1}`} className="w-full h-32 object-cover rounded-lg border-2 border-border" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Informações adicionais sobre o veículo..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : vehicle ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
