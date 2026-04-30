import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { User, Shield, Bell, Database, AlertCircle, CheckCircle } from 'lucide-react';

type MessageState = {
  type: 'success' | 'error';
  text: string;
} | null;

export function Settings() {
  const { profile, user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: ''
  });
  const [securityForm, setSecurityForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [notificationsForm, setNotificationsForm] = useState({
    newNegotiations: true,
    vehicleUpdates: true,
    weeklyReports: false
  });

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'security', label: 'Seguranca', icon: Shield },
    { id: 'notifications', label: 'Notificacoes', icon: Bell },
    { id: 'system', label: 'Sistema', icon: Database }
  ];

  useEffect(() => {
    setProfileForm({
      fullName: profile?.full_name || '',
      email: profile?.email || user?.email || ''
    });
  }, [profile, user]);

  useEffect(() => {
    if (!user) return;

    const stored = localStorage.getItem(`luxcar-notifications:${user.id}`);
    if (!stored) return;

    try {
      setNotificationsForm(JSON.parse(stored));
    } catch {
      localStorage.removeItem(`luxcar-notifications:${user.id}`);
    }
  }, [user]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    setMessage(null);

    try {
      if (activeTab === 'profile') {
        const nextName = profileForm.fullName.trim();
        const nextEmail = profileForm.email.trim();

        if (!nextName) {
          throw new Error('Informe o nome completo.');
        }

        if (!nextEmail) {
          throw new Error('Informe o email.');
        }

        const updates: Record<string, string> = {};

        if (nextName !== profile.full_name) {
          updates.full_name = nextName;
        }

        if (nextEmail !== profile.email) {
          updates.email = nextEmail;
        }

        if (Object.keys(updates).length > 0) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', profile.id);

          if (profileError) throw profileError;
        }

        if (nextEmail !== user.email) {
          const { error: authError } = await supabase.auth.updateUser({
            email: nextEmail
          });

          if (authError) throw authError;
        }

        await refreshProfile();
        showMessage('success', 'Perfil atualizado com sucesso.');
      }

      if (activeTab === 'security') {
        if (!securityForm.newPassword) {
          throw new Error('Informe a nova senha.');
        }

        if (securityForm.newPassword.length < 6) {
          throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
        }

        if (securityForm.newPassword !== securityForm.confirmPassword) {
          throw new Error('A confirmacao da senha nao confere.');
        }

        const { error } = await supabase.auth.updateUser({
          password: securityForm.newPassword
        });

        if (error) throw error;

        setSecurityForm({
          newPassword: '',
          confirmPassword: ''
        });

        showMessage('success', 'Senha atualizada com sucesso.');
      }

      if (activeTab === 'notifications') {
        localStorage.setItem(
          `luxcar-notifications:${user.id}`,
          JSON.stringify(notificationsForm)
        );

        showMessage('success', 'Preferencias de notificacao salvas.');
      }

      if (activeTab === 'system') {
        showMessage('success', 'Nenhuma configuracao editavel nesta aba.');
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Nao foi possivel salvar.');
    } finally {
      setSaving(false);
    }
  };

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleExportData = async (mode: 'export' | 'backup') => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const [vehiclesRes, negotiationsRes, costsRes, interactionsRes, salesRes] = await Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
        supabase.from('negotiations').select('*').order('created_at', { ascending: false }),
        supabase.from('vehicle_costs').select('*').order('created_at', { ascending: false }),
        supabase.from('interaction_history').select('*').order('created_at', { ascending: false }),
        supabase.from('sales').select('*').order('created_at', { ascending: false })
      ]);

      const failedResponse = [vehiclesRes, negotiationsRes, costsRes, interactionsRes, salesRes]
        .find((response) => response.error);

      if (failedResponse?.error) {
        throw failedResponse.error;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      downloadJson(`luxcar-${mode}-${timestamp}.json`, {
        generated_at: new Date().toISOString(),
        generated_by: {
          id: user.id,
          email: user.email,
          profile_name: profile?.full_name || null
        },
        vehicles: vehiclesRes.data || [],
        negotiations: negotiationsRes.data || [],
        vehicle_costs: costsRes.data || [],
        interaction_history: interactionsRes.data || [],
        sales: salesRes.data || []
      });

      showMessage('success', mode === 'backup' ? 'Backup gerado com sucesso.' : 'Exportacao gerada com sucesso.');
    } catch (error: any) {
      showMessage('error', error.message || 'Nao foi possivel exportar os dados.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = () => {
    try {
      if (user) {
        localStorage.removeItem(`luxcar-notifications:${user.id}`);
      }

      sessionStorage.clear();
      showMessage('success', 'Cache local limpo com sucesso.');
    } catch (error: any) {
      showMessage('error', error.message || 'Nao foi possivel limpar o cache.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuracoes</h1>
        <p className="text-gray-600 mt-1">Gerencie suas preferencias e configuracoes do sistema</p>
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
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Informacoes do Perfil</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
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
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Seguranca</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nova Senha
                      </label>
                      <input
                        type="password"
                        value={securityForm.newPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Minimo de 6 caracteres"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type="password"
                        value={securityForm.confirmPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Repita a nova senha"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Preferencias de Notificacao</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Novas Negociacoes</p>
                        <p className="text-sm text-gray-500">Receber alertas quando houver novas negociacoes</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationsForm.newNegotiations}
                        onChange={(e) => setNotificationsForm({ ...notificationsForm, newNegotiations: e.target.checked })}
                        className="w-5 h-5 text-blue-600"
                      />
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Atualizacoes de Veiculos</p>
                        <p className="text-sm text-gray-500">Notificar sobre mudancas no estoque</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationsForm.vehicleUpdates}
                        onChange={(e) => setNotificationsForm({ ...notificationsForm, vehicleUpdates: e.target.checked })}
                        className="w-5 h-5 text-blue-600"
                      />
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Relatorios Semanais</p>
                        <p className="text-sm text-gray-500">Receber resumo semanal de vendas</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationsForm.weeklyReports}
                        onChange={(e) => setNotificationsForm({ ...notificationsForm, weeklyReports: e.target.checked })}
                        className="w-5 h-5 text-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Configuracoes do Sistema</h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Versao:</strong> 1.0.0
                      </p>
                      <p className="text-sm text-blue-800 mt-1">
                        <strong>Banco de Dados:</strong> Supabase
                      </p>
                      <p className="text-sm text-blue-800 mt-1">
                        <strong>Usuario:</strong> {profile?.full_name || 'Nao identificado'}
                      </p>
                    </div>
                    <div className="pt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Acoes do Sistema</h3>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => handleExportData('export')}
                          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left"
                        >
                          Exportar Dados
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportData('backup')}
                          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left"
                        >
                          Backup do Sistema
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCache}
                          className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-left"
                        >
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
                {saving ? 'Salvando...' : 'Salvar Alteracoes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileForm({
                    fullName: profile?.full_name || '',
                    email: profile?.email || user?.email || ''
                  });
                  setSecurityForm({
                    newPassword: '',
                    confirmPassword: ''
                  });
                }}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
