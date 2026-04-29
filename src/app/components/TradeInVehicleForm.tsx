import { useState, useEffect } from 'react';
import { supabase, TradeInVehicle } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, AlertCircle, Upload, Trash2 } from 'lucide-react';
import { CAR_BRANDS } from '../../constants/carBrands';

type TradeInVehicleFormProps = {
  negotiationId: string;
  companyId: string;
  existingTradeIn?: TradeInVehicle | null;
  onClose: () => void;
};

export function TradeInVehicleForm({ negotiationId, companyId, existingTradeIn, onClose }: TradeInVehicleFormProps) {
  const { user } = useAuth();
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
      setError(err.message || 'Erro ao salvar veículo de troca');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {existingTradeIn ? 'Editar Veículo na Troca' : 'Adicionar Veículo na Troca'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-2">
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
                <option value="">Selecione...</option>
                {CAR_BRANDS.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
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
              />
            </div>

            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
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
              <label htmlFor="version" className="block text-sm font-medium text-gray-700 mb-2">
                Versão
              </label>
              <input
                type="text"
                id="version"
                name="version"
                value={formData.version}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="plate" className="block text-sm font-medium text-gray-700 mb-2">
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
            </div>

            <div>
              <label htmlFor="mileage" className="block text-sm font-medium text-gray-700 mb-2">
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
              />
            </div>

            <div>
              <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-2">
                Cor
              </label>
              <input
                type="text"
                id="color"
                name="color"
                value={formData.color}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="fuel_type" className="block text-sm font-medium text-gray-700 mb-2">
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
              <label htmlFor="transmission" className="block text-sm font-medium text-gray-700 mb-2">
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
                <option value="automatizada">Automatizada</option>
                <option value="cvt">CVT</option>
              </select>
            </div>

            <div>
              <label htmlFor="evaluated_value" className="block text-sm font-medium text-gray-700 mb-2">
                Valor Avaliado (R$)
              </label>
              <input
                type="number"
                id="evaluated_value"
                name="evaluated_value"
                value={formData.evaluated_value}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="offered_value" className="block text-sm font-medium text-gray-700 mb-2">
                Valor Oferecido (R$)
              </label>
              <input
                type="number"
                id="offered_value"
                name="offered_value"
                value={formData.offered_value}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="evaluator_name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Avaliador
              </label>
              <input
                type="text"
                id="evaluator_name"
                name="evaluator_name"
                value={formData.evaluator_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: João Silva"
              />
            </div>

            <div>
              <label htmlFor="evaluation_date" className="block text-sm font-medium text-gray-700 mb-2">
                Data da Avaliação
              </label>
              <input
                type="date"
                id="evaluation_date"
                name="evaluation_date"
                value={formData.evaluation_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="needs_evaluation"
                  checked={formData.needs_evaluation}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Precisa de avaliação</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="condition_notes" className="block text-sm font-medium text-gray-700 mb-2">
              Observações sobre o Estado
            </label>
            <textarea
              id="condition_notes"
              name="condition_notes"
              value={formData.condition_notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descreva o estado do veículo, avarias, reparos necessários..."
            />
          </div>

          <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              Fotos do Veículo de Troca
            </label>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white hover:border-blue-400 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <input
                type="file"
                id="image-upload-trade"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="image-upload-trade"
                className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Selecionar Fotos
              </label>
              <p className="text-sm text-gray-500 mt-3">PNG, JPG ou WEBP</p>
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
              {loading ? 'Salvando...' : existingTradeIn ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
