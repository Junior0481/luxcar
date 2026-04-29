import { useState, useEffect } from 'react';
import { useFipe, FipeBrand, FipeModel, FipeYear } from '../../hooks/useFipe';
import { Search, AlertCircle, CheckCircle } from 'lucide-react';

type FipeSearchProps = {
  onValueFound?: (value: number, fipeCode: string) => void;
};

export function FipeSearch({ onValueFound }: FipeSearchProps) {
  const { loading, error, fetchBrands, fetchModels, fetchYears, fetchVehicleValue, parseValue } = useFipe();

  const [brands, setBrands] = useState<FipeBrand[]>([]);
  const [models, setModels] = useState<FipeModel[]>([]);
  const [years, setYears] = useState<FipeYear[]>([]);

  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [fipeResult, setFipeResult] = useState<{ value: number; code: string } | null>(null);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    const data = await fetchBrands();
    setBrands(data);
  };

  const handleBrandChange = async (brandCode: string) => {
    setSelectedBrand(brandCode);
    setSelectedModel('');
    setSelectedYear('');
    setModels([]);
    setYears([]);
    setFipeResult(null);

    if (brandCode) {
      const data = await fetchModels(brandCode);
      setModels(data);
    }
  };

  const handleModelChange = async (modelCode: string) => {
    setSelectedModel(modelCode);
    setSelectedYear('');
    setYears([]);
    setFipeResult(null);

    if (modelCode && selectedBrand) {
      const data = await fetchYears(selectedBrand, parseInt(modelCode));
      setYears(data);
    }
  };

  const handleYearChange = async (yearCode: string) => {
    setSelectedYear(yearCode);
    setFipeResult(null);

    if (yearCode && selectedBrand && selectedModel) {
      const data = await fetchVehicleValue(selectedBrand, parseInt(selectedModel), yearCode);
      if (data) {
        const value = parseValue(data.Valor);
        setFipeResult({ value, code: data.CodigoFipe });
        onValueFound?.(value, data.CodigoFipe);
      }
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">Consultar Tabela FIPE</h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1">Marca</label>
          <select
            value={selectedBrand}
            onChange={(e) => handleBrandChange(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Selecione a marca</option>
            {brands.map((brand) => (
              <option key={brand.codigo} value={brand.codigo}>
                {brand.nome}
              </option>
            ))}
          </select>
        </div>

        {models.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">Modelo</label>
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Selecione o modelo</option>
              {models.map((model) => (
                <option key={model.codigo} value={model.codigo}>
                  {model.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {years.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">Ano</label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Selecione o ano</option>
              {years.map((year) => (
                <option key={year.codigo} value={year.codigo}>
                  {year.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}

        {fipeResult && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Valor FIPE encontrado</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fipeResult.value)}
                </p>
                <p className="text-xs text-green-600 mt-1">Código FIPE: {fipeResult.code}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-blue-600 mt-4">
        💡 Os valores são consultados em tempo real da Tabela FIPE oficial
      </p>
    </div>
  );
}
