import { useState, useEffect } from 'react';
import { supabase, TradeInVehicle } from '../../lib/supabase';
import { X, AlertCircle, Upload, Trash2 } from 'lucide-react';
import { CAR_BRANDS } from '../../constants/carBrands';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

type TradeInVehicleFormProps = {
  negotiationId: string;
  companyId: string;
  existingTradeIn?: TradeInVehicle | null;
  onClose: () => void;
};

const selectClass =
  'w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export function TradeInVehicleForm({ negotiationId, companyId, existingTradeIn, onClose }: TradeInVehicleFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    version: '',
    plate: '',
    mileage: '',
    color: '',
    fuel_type: '',
    transmission: '',
    condition_notes: '',
    evaluated_value: '',
    offered_value: '',
    evaluator_name: '',
    evaluation_date: '',
    needs_evaluation: true
  });

  useEffect(() => {
    if (existingTradeIn) {
      setFormData({
        brand: existingTradeIn.brand,
        model: existingTradeIn.model,
        year: existingTradeIn.year,
        version: existingTradeIn.version || '',
        plate: existingTradeIn.plate || '',
        mileage: existingTradeIn.mileage?.toString() || '',
        color: existingTradeIn.color || '',
        fuel_type: existingTradeIn.fuel_type || '',
        transmission: existingTradeIn.transmission || '',
        condition_notes: existingTradeIn.condition_notes || '',
        evaluated_value: existingTradeIn.evaluated_value?.toString() || '',
        offered_value: existingTradeIn.offered_value?.toString() || '',
        evaluator_name: existingTradeIn.evaluator_name || '',
        evaluation_date: existingTradeIn.evaluation_date || '',
        needs_evaluation: existingTradeIn.needs_evaluation
      });
      if (existingTradeIn.images) {
        setImageUrls(existingTradeIn.images);
      }
    }
  }, [existingTradeIn]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tradeInData = {
        negotiation_id: negotiationId,
        company_id: companyId,
        brand: formData.brand,
        model: formData.model,
        year: formData.year,
        version: formData.version || null,
        plate: formData.plate || null,
        mileage: formData.mileage ? parseInt(formData.mileage) : null,
        color: formData.color || null,
        fuel_type: formData.fuel_type || null,
        transmission: formData.transmission || null,
        condition_notes: formData.condition_notes || null,
        evaluated_value: formData.evaluated_value ? parseFloat(formData.evaluated_value) : null,
        offered_value: formData.offered_value ? parseFloat(formData.offered_value) : null,
        evaluator_name: formData.evaluator_name || null,
        evaluation_date: formData.evaluation_date || null,
        needs_evaluation: formData.needs_evaluation,
        images: imageUrls
      };

      if (existingTradeIn) {
        const { error } = await supabase
          .from('trade_in_vehicles')
          .update(tradeInData)
          .eq('id', existingTradeIn.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('trade_in_vehicles')
          .insert([tradeInData]);
        if (error) throw error;
      }

      onClose();
    } catch (err: any) {
      if (err.code === '42P01') {
        setError('A tabela de veículos na troca ainda não existe no banco. Execute o SQL complementar para habilitar este módulo.');
      } else {
        setError(err.message || 'Erro ao salvar veículo de troca');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-4xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            {existingTradeIn ? 'Editar Veículo na Troca' : 'Adicionar Veículo na Troca'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Marca *</Label>
              <select id="brand" name="brand" value={formData.brand} onChange={handleChange} required className={selectClass}>
                <option value="">Selecione...</option>
                {CAR_BRANDS.map(brand => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input id="model" name="model" value={formData.model} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Ano *</Label>
              <Input type="number" id="year" name="year" value={formData.year} onChange={handleChange} required min="1900" max={new Date().getFullYear() + 1} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">Versão</Label>
              <Input id="version" name="version" value={formData.version} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plate">Placa</Label>
              <Input id="plate" name="plate" value={formData.plate} onChange={handlePlateChange} maxLength={8} className="uppercase" placeholder="ABC-1D23" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mileage">Quilometragem (km)</Label>
              <Input type="number" id="mileage" name="mileage" value={formData.mileage} onChange={handleChange} min="0" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input id="color" name="color" value={formData.color} onChange={handleChange} />
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

            <div className="space-y-2">
              <Label htmlFor="evaluated_value">Valor Avaliado (R$)</Label>
              <Input type="number" id="evaluated_value" name="evaluated_value" value={formData.evaluated_value} onChange={handleChange} step="0.01" min="0" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="offered_value">Valor Oferecido (R$)</Label>
              <Input type="number" id="offered_value" name="offered_value" value={formData.offered_value} onChange={handleChange} step="0.01" min="0" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evaluator_name">Nome do Avaliador</Label>
              <Input id="evaluator_name" name="evaluator_name" value={formData.evaluator_name} onChange={handleChange} placeholder="Ex: João Silva" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evaluation_date">Data da Avaliação</Label>
              <Input type="date" id="evaluation_date" name="evaluation_date" value={formData.evaluation_date} onChange={handleChange} />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="needs_evaluation"
                  checked={formData.needs_evaluation}
                  onChange={handleChange}
                  className="w-4 h-4 rounded accent-[var(--primary)]"
                />
                <span className="text-sm font-medium text-foreground">Precisa de avaliação</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition_notes">Observações sobre o Estado</Label>
            <Textarea
              id="condition_notes"
              name="condition_notes"
              value={formData.condition_notes}
              onChange={handleChange}
              rows={3}
              placeholder="Descreva o estado do veículo, avarias, reparos necessários..."
            />
          </div>

          <div className="border border-border rounded-lg bg-muted p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Fotos do Veículo de Troca</p>

            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-card hover:border-primary transition-colors">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <input type="file" id="image-upload-trade" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              <label
                htmlFor="image-upload-trade"
                className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Selecionar Fotos
              </label>
              <p className="text-sm text-muted-foreground mt-3">PNG, JPG ou WEBP</p>
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

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : existingTradeIn ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
