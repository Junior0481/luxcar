import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Shield, Bell, Database, AlertCircle, CheckCircle } from 'lucide-react';

export function Settings() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'system', label: 'Sistema', icon: Database }
  ];

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    setTimeout(() => {
      setSaving(false);
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-1">Gerencie suas preferências e configurações do sistema</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${
            message.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Informações do Perfil</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        defaultValue={profile?.full_name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        defaultValue={profile?.email}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Conta
                      </label>
                      <input
                        type="text"
                        value={profile?.role === 'administrador' ? 'Administrador' : 'Vendedor'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Segurança</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Senha Atual
                      </label>
                      <input
                        type="password"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nova Senha
                      </label>
                      <input
                        type="password"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type="password"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Preferências de Notificação</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Novas Negociações</p>
                        <p className="text-sm text-gray-500">Receber alertas quando houver novas negociações</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Atualizações de Veículos</p>
                        <p className="text-sm text-gray-500">Notificar sobre mudanças no estoque</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Relatórios Semanais</p>
                        <p className="text-sm text-gray-500">Receber resumo semanal de vendas</p>
                      </div>
                      <input type="checkbox" className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Configurações do Sistema</h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Versão:</strong> 1.0.0
                      </p>
                      <p className="text-sm text-blue-800 mt-1">
                        <strong>Banco de Dados:</strong> Supabase (Conectado)
                      </p>
                      <p className="text-sm text-blue-800 mt-1">
                        <strong>Plano:</strong> SaaS Bronze
                      </p>
                    </div>
                    <div className="pt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Ações do Sistema</h3>
                      <div className="space-y-2">
                        <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left">
                          Exportar Dados
                        </button>
                        <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left">
                          Backup do Sistema
                        </button>
                        <button className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-left">
                          Limpar Cache
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
