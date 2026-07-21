import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { User, Shield, Bell, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';

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
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'notifications', label: 'Notificações', icon: Bell },
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
          throw new Error('A confirmação da senha não confere.');
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

        showMessage('success', 'Preferências de notificação salvas.');
      }

      if (activeTab === 'system') {
        showMessage('success', 'Nenhuma configuração editável nesta aba.');
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Não foi possível salvar.');
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

      showMessage('success', mode === 'backup' ? 'Backup gerado com sucesso.' : 'Exportação gerada com sucesso.');
    } catch (error: any) {
      showMessage('error', error.message || 'Não foi possível exportar os dados.');
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
      showMessage('error', error.message || 'Não foi possível limpar o cache.');
    }
  };

  const notificationRows = [
    { key: 'newNegotiations' as const, title: 'Novas Negociações', desc: 'Receber alertas quando houver novas negociações' },
    { key: 'vehicleUpdates' as const, title: 'Atualizações de Veículos', desc: 'Notificar sobre mudanças no estoque' },
    { key: 'weeklyReports' as const, title: 'Relatórios Semanais', desc: 'Receber resumo semanal de vendas' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas preferências e configurações do sistema</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 border ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-destructive/10 border-destructive/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${
            message.type === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card className="py-2 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-l-2 ${
                  activeTab === tab.id
                    ? 'bg-accent text-primary border-primary'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground border-transparent'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardContent>
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-foreground">Informações do Perfil</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <Input
                        id="fullName"
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Tipo de Conta</Label>
                      <Input
                        id="role"
                        value={profile?.role === 'administrador' ? 'Administrador' : 'Vendedor'}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-foreground">Segurança</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Nova Senha</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={securityForm.newPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                        placeholder="Mínimo de 6 caracteres"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={securityForm.confirmPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                        placeholder="Repita a nova senha"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-foreground">Preferências de Notificação</h2>
                  <div className="divide-y divide-border">
                    {notificationRows.map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-4 py-4">
                        <div>
                          <p className="font-medium text-foreground">{row.title}</p>
                          <p className="text-sm text-muted-foreground">{row.desc}</p>
                        </div>
                        <Switch
                          checked={notificationsForm[row.key]}
                          onCheckedChange={(checked) =>
                            setNotificationsForm({ ...notificationsForm, [row.key]: checked })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-foreground">Configurações do Sistema</h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-accent border border-border rounded-lg space-y-1 text-sm text-foreground">
                      <p><strong>Versão:</strong> 1.0.0</p>
                      <p><strong>Banco de Dados:</strong> Supabase</p>
                      <p><strong>Usuário:</strong> {profile?.full_name || 'Não identificado'}</p>
                    </div>
                    <div className="pt-2">
                      <h3 className="font-semibold text-foreground mb-3">Ações do Sistema</h3>
                      <div className="space-y-2">
                        <Button variant="secondary" className="w-full justify-start" onClick={() => handleExportData('export')}>
                          Exportar Dados
                        </Button>
                        <Button variant="secondary" className="w-full justify-start" onClick={() => handleExportData('backup')}>
                          Backup do Sistema
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-destructive hover:text-destructive"
                          onClick={handleClearCache}
                        >
                          Limpar Cache
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-6 border-t border-border mt-6">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
                <Button
                  variant="secondary"
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
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
