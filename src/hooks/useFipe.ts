import { useState } from 'react';

const FIPE_API_URL = import.meta.env.VITE_FIPE_API_URL || 'https://parallelum.com.br/fipe/api/v1';

export type FipeBrand = {
  nome: string;
  codigo: string;
};

export type FipeModel = {
  nome: string;
  codigo: number;
};

export type FipeYear = {
  nome: string;
  codigo: string;
};

export type FipeVehicle = {
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
  TipoVeiculo: number;
  SiglaCombustivel: string;
};

export function useFipe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = async (vehicleType: 'carros' | 'motos' | 'caminhoes' = 'carros'): Promise<FipeBrand[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${FIPE_API_URL}/${vehicleType}/marcas`);
      if (!response.ok) throw new Error('Erro ao buscar marcas');
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async (
    brandCode: string,
    vehicleType: 'carros' | 'motos' | 'caminhoes' = 'carros'
  ): Promise<FipeModel[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${FIPE_API_URL}/${vehicleType}/marcas/${brandCode}/modelos`);
      if (!response.ok) throw new Error('Erro ao buscar modelos');
      const data = await response.json();
      return data.modelos || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchYears = async (
    brandCode: string,
    modelCode: number,
    vehicleType: 'carros' | 'motos' | 'caminhoes' = 'carros'
  ): Promise<FipeYear[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${FIPE_API_URL}/${vehicleType}/marcas/${brandCode}/modelos/${modelCode}/anos`
      );
      if (!response.ok) throw new Error('Erro ao buscar anos');
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicleValue = async (
    brandCode: string,
    modelCode: number,
    yearCode: string,
    vehicleType: 'carros' | 'motos' | 'caminhoes' = 'carros'
  ): Promise<FipeVehicle | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${FIPE_API_URL}/${vehicleType}/marcas/${brandCode}/modelos/${modelCode}/anos/${yearCode}`
      );
      if (!response.ok) throw new Error('Erro ao buscar valor do veículo');
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const parseValue = (fipeValue: string): number => {
    return parseFloat(fipeValue.replace('R$ ', '').replace(/\./g, '').replace(',', '.'));
  };

  return {
    loading,
    error,
    fetchBrands,
    fetchModels,
    fetchYears,
    fetchVehicleValue,
    parseValue
  };
}
