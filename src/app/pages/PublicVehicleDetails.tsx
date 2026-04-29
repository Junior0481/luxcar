import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { supabase, Vehicle } from '../../lib/supabase';
import { ArrowLeft, Car, Calendar, Gauge, Fuel, Settings as SettingsIcon, MapPin, Phone, Mail, Heart, MessageCircle } from 'lucide-react';
import { LeadForm } from '../components/LeadForm';

type PublicVehicle = Vehicle & {
  company_name?: string;
  company_slug?: string;
  company_city?: string;
  company_state?: string;
  company_phone?: string;
};

export function PublicVehicleDetails() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    if (id) {
      loadVehicle();
    }
  }, [id]);

  const loadVehicle = async () => {
    try {
      let { data, error } = await supabase
        .from('public_vehicles')
        .select('*')
        .eq('id', id)
        .single();

      // Se a view não existir, carrega direto da tabela
      if (error && error.code === '42P01') {
        const result = await supabase
          .from('vehicles')
          .select(`
            *,
            companies:company_id (
              name,
              slug,
              city,
              state,
              phone
            )
          `)
          .eq('id', id)
          .single();

        if (result.error) throw result.error;

        data = {
          ...result.data,
          company_name: result.data.companies?.name,
          company_slug: result.data.companies?.slug,
          company_city: result.data.companies?.city,
          company_state: result.data.companies?.state,
          company_phone: result.data.companies?.phone
        };
      } else if (error) {
        throw error;
      }

      setVehicle(data);
    } catch (error) {
      console.error('Error loading vehicle:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Veículo não encontrado</h2>
          <Link to="/" className="text-blue-600 hover:text-blue-700">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    );
  }

  const images = vehicle.images && vehicle.images.length > 0 ? vehicle.images : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <Car className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">LuxCar</h1>
            </Link>
            <Link
              to="/client/login"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-5 h-5" />
          Voltar para a busca
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {images.length > 0 ? (
                <>
                  <div className="relative h-96 bg-gray-100">
                    <img
                      src={images[selectedImage]}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {images.length > 1 && (
                    <div className="p-4 grid grid-cols-6 gap-2">
                      {images.map((img, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImage(index)}
                          className={`aspect-video rounded-lg overflow-hidden border-2 ${
                            selectedImage === index ? 'border-blue-600' : 'border-gray-200'
                          }`}
                        >
                          <img src={img} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-96 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Car className="w-24 h-24 text-gray-400" />
                </div>
              )}
            </div>

            {/* Vehicle Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {vehicle.brand} {vehicle.model}
                  </h1>
                  <p className="text-xl text-gray-600">{vehicle.version}</p>
                </div>
                <button className="p-3 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
                  <Heart className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              <p className="text-4xl font-bold text-blue-600 mb-6">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.sale_price)}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {vehicle.year && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">Ano</p>
                      <p className="font-semibold text-gray-900">{vehicle.year}</p>
                    </div>
                  </div>
                )}
                {vehicle.mileage && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Gauge className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">KM</p>
                      <p className="font-semibold text-gray-900">{vehicle.mileage.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                )}
                {vehicle.fuel_type && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Fuel className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">Combustível</p>
                      <p className="font-semibold text-gray-900 capitalize">{vehicle.fuel_type}</p>
                    </div>
                  </div>
                )}
                {vehicle.transmission && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <SettingsIcon className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">Câmbio</p>
                      <p className="font-semibold text-gray-900 capitalize">{vehicle.transmission}</p>
                    </div>
                  </div>
                )}
              </div>

              {vehicle.description && (
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Descrição</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{vehicle.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Contact */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-4">Interessado?</h3>

              <button
                onClick={() => setShowLeadForm(true)}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium mb-3 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Enviar Mensagem
              </button>

              {vehicle.company_phone && (
                <a
                  href={`https://wa.me/55${vehicle.company_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium mb-4 flex items-center justify-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  WhatsApp
                </a>
              )}

              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">Anunciante</h4>

                {vehicle.company_name && (
                  <div className="mb-3">
                    <p className="font-medium text-gray-900">{vehicle.company_name}</p>
                  </div>
                )}

                {vehicle.company_city && vehicle.company_state && (
                  <div className="flex items-start gap-2 text-gray-600 mb-2">
                    <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{vehicle.company_city} - {vehicle.company_state}</p>
                  </div>
                )}

                {vehicle.company_phone && (
                  <div className="flex items-start gap-2 text-gray-600">
                    <Phone className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{vehicle.company_phone}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showLeadForm && vehicle && (
        <LeadForm
          vehicleId={vehicle.id}
          companyId={vehicle.company_id || ''}
          vehicleName={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
          onClose={() => setShowLeadForm(false)}
        />
      )}
    </div>
  );
}
