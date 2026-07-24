import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Bell, CheckCircle, Database, Palette, Shield, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { PageHeader } from '../components/ui/page-header';
import { cn } from '../components/ui/utils';

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
    { id: 'profile', label: 'Perfil', desc: 'Dados da conta', icon: User },
    { id: 'security', label: 'Segurança', desc: 'Acesso e senha', icon: Shield },
    { id: 'notifications', label: 'Notificações', desc: 'Alertas da operação', icon: Bell },
    { id: 'system', label: 'Sistema', desc: 'Dados e backup', icon: Database }
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

        if (!nextName) throw new Error('Informe o nome completo.');
        if (!nextEmail) throw new Error('Informe o email.');

        const updates: Record<string, string> = {};
        if (nextName !== profile.full_name) updates.full_name = nextName;
        if (nextEmail !== profile.email) updates.email = nextEmail;

        if (Object.keys(updates).length > 0) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', profile.id);

          if (profileError) throw profileError;
        }

        if (nextEmail !== user.email) {
          const { error: authError } = await supabase.auth.updateUser({ email: nextEmail });
          if (authError) throw authError;
        }

        await refreshProfile();
        showMessage('success', 'Perfil atualizado.');
      }

      if (activeTab === 'security') {
        if (!securityForm.newPassword) throw new Error('Informe a nova senha.');
        if (securityForm.newPassword.length < 6) throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
        if (securityForm.newPassword !== securityForm.confirmPassword) throw new Error('A confirmação da senha não confere.');

        const { error } = await supabase.auth.updateUser({ password: securityForm.newPassword });
        if (error) throw error;

        setSecurityForm({ newPassword: '', confirmPassword: '' });
        showMessage('success', 'Senha atualizada.');
      }

      if (activeTab === 'notifications') {
        localStorage.setItem(`luxcar-notifications:${user.id}`, JSON.stringify(notificationsForm));
        showMessage('success', 'Preferencias salvas.');
      }

      if (activeTab === 'system') {
        showMessage('success', 'Nenhuma configuração editável nesta aba.');
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Não foi possivel salvar.');
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

      if (failedResponse?.error) throw failedResponse.error;

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

      showMessage('success', mode === 'backup' ? 'Backup gerado.' : 'Exportação gerada.');
    } catch (error: any) {
      showMessage('error', error.message || 'Não foi possivel exportar os dados.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = () => {
    try {
      if (user) localStorage.removeItem(`luxcar-notifications:${user.id}`);
      sessionStorage.clear();
      showMessage('success', 'Cache local limpo.');
    } catch (error: any) {
      showMessage('error', error.message || 'Não foi possivel limpar o cache.');
    }
  };

  const notificationRows = [
    { key: 'newNegotiations' as const, title: 'Novas negociações', desc: 'Receber alertas quando houver novas oportunidades' },
    { key: 'vehicleUpdates' as const, title: 'Atualizações de veículos', desc: 'Notificar sobre mudancas importantes no estoque' },
    { key: 'weeklyReports' as const, title: 'Resumo semanal', desc: 'Receber uma leitura semanal de vendas e pipeline' }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Palette}
        eyebrow="Operação e identidade"
        title="Configurações"
        description="Ajuste perfil, segurança, preferências e dados operacionais da loja."
      />

      {message && (
        <div className={cn(
          'flex items-start gap-3 rounded-2xl border p-4 shadow-lux-sm',
          message.type === 'success'
            ? 'border-primary/20 bg-accent text-accent-foreground'
            : 'border-destructive/30 bg-destructive/10 text-destructive'
        )}>
          {message.type === 'success' ? (
            <CheckCircle className="mt-0.5 size-5 shrink-0 text-primary" />
          ) : (
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <Card className="gap-0 overflow-hidden py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors',
                  activeTab === tab.id
                    ? 'border-primary bg-accent text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <tab.icon className="size-5" />
                <span>
                  <span className="block text-sm font-medium">{tab.label}</span>
                  <span className="block text-xs opacity-70">{tab.desc}</span>
                </span>
              </button>
            ))}
          </Card>
        </aside>

        <section className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{tabs.find((tab) => tab.id === activeTab)?.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {activeTab === 'profile' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
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
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="role">Tipo de conta</Label>
                    <Input
                      id="role"
                      value={profile?.role === 'administrador' ? 'Administrador' : 'Vendedor'}
                      disabled
                    />
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova senha</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={securityForm.newPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                      placeholder="Minimo de 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={securityForm.confirmPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                      placeholder="Repita a nova senha"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
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
              )}

              {activeTab === 'system' && (
                <div className="space-y-6">
                  <div className="grid gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm md:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Versao</p>
                      <p className="font-medium text-foreground">1.0.0</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Banco de dados</p>
                      <p className="font-medium text-foreground">Supabase</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Responsavel</p>
                      <p className="font-medium text-foreground">{profile?.full_name || 'Não identificado'}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button variant="secondary" onClick={() => handleExportData('export')}>
                      Exportar dados
                    </Button>
                    <Button variant="secondary" onClick={() => handleExportData('backup')}>
                      Gerar backup
                    </Button>
                    <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleClearCache}>
                      Limpar cache
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setProfileForm({
                      fullName: profile?.full_name || '',
                      email: profile?.email || user?.email || ''
                    });
                    setSecurityForm({ newPassword: '', confirmPassword: '' });
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}



