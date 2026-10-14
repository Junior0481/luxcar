import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Bell, Car, CheckCircle, Database, Palette, Shield, Upload, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cn } from '../components/ui/utils';

type MessageState = {
  type: 'success' | 'error';
  text: string;
} | null;

const hexRgb = (value: string) => {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value.trim());
  return match ? [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)] as const : null;
};

const relativeLuminance = (color: readonly number[]) => {
  const channels = color.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (first: readonly number[], second: readonly number[]) => {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

const primaryColorWarning = (value: string) => {
  const color = hexRgb(value);
  const text = hexRgb('#170A02')!;
  const panel = hexRgb('#0E1013')!;
  if (!color) return 'Informe uma cor hexadecimal válida.';
  const maximum = Math.max(...color);
  const minimum = Math.min(...color);
  const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
  const tooSaturated = saturation > 0.95 && maximum / 255 > 0.92;
  if (contrastRatio(color, text) < 4.5 || contrastRatio(color, panel) < 4.5 || tooSaturated) {
    return 'Esse tom pode dificultar a leitura ou está muito saturado. Sugestão: experimente uma cor mais fechada, como #D66A2D.';
  }
  return '';
};

export function Settings() {
  const { profile, user, refreshProfile, loading } = useAuth();
  const { company } = useCompany();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [uploadingBrandAsset, setUploadingBrandAsset] = useState<'logo' | 'favicon' | null>(null);
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
    negotiationStatus: true,
    linkedVehicleUpdates: true
  });
  const [brandingForm, setBrandingForm] = useState({
    name: '', logoUrl: '', faviconUrl: '', primaryColor: '#f8a746', secondaryColor: '#111827', customDomain: ''
  });

  const tabs = [
    { id: 'profile', label: 'Perfil', desc: 'Dados da conta', icon: User },
    ...(profile?.role === 'administrador' ? [{ id: 'branding', label: 'Marca', desc: 'Identidade white label', icon: Palette }] : []),
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
    if (!company) return;
    setBrandingForm({
      name: company.name || '', logoUrl: company.logo_url || '', faviconUrl: company.favicon_url || '',
      primaryColor: company.primary_color || '#f8a746', secondaryColor: company.secondary_color || '#111827',
      customDomain: company.custom_domain || ''
    });
  }, [company]);

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

  const validateBrandImage = async (file: File, kind: 'logo' | 'favicon') => {
    const dimensions = kind === 'logo' ? { width: 512, height: 256, label: '512 × 256 px' } : { width: 64, height: 64, label: '64 × 64 px' };
    if (file.type !== 'image/png') throw new Error(`Envie um arquivo PNG com ${dimensions.label}.`);
    if (file.size > 2 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 2 MB.');
    let image: ImageBitmap;
    try { image = await createImageBitmap(file); } catch { throw new Error('Não foi possível ler a imagem. Escolha um arquivo PNG válido.'); }
    const { width, height } = image;
    image.close();
    if (width !== dimensions.width || height !== dimensions.height) {
      throw new Error(`Dimensões incorretas: a imagem enviada tem ${width} × ${height} px. O tamanho exigido é ${dimensions.label}.`);
    }
  };

  const handleBrandImageUpload = async (kind: 'logo' | 'favicon', file?: File) => {
    if (!file || !profile?.company_id || profile.role !== 'administrador') return;
    setUploadingBrandAsset(kind);
    setMessage(null);
    try {
      await validateBrandImage(file, kind);
      const objectPath = `${profile.company_id}/${kind}-${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage.from('company-branding').upload(objectPath, file, {
        cacheControl: '3600', contentType: 'image/png', upsert: false
      });
      if (error) throw error;
      const { data } = supabase.storage.from('company-branding').getPublicUrl(objectPath);
      setBrandingForm((current) => kind === 'logo' ? { ...current, logoUrl: data.publicUrl } : { ...current, faviconUrl: data.publicUrl });
      showMessage('success', `${kind === 'logo' ? 'Logo' : 'Favicon'} enviado. Salve as alterações para aplicar na loja.`);
    } catch (error: any) {
      showMessage('error', error.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploadingBrandAsset(null);
    }
  };

  const storagePathFromPublicUrl = (value: string) => {
    const marker = '/storage/v1/object/public/company-branding/';
    const index = value.indexOf(marker);
    return index < 0 ? null : decodeURIComponent(value.slice(index + marker.length).split('?')[0]);
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

      if (activeTab === 'branding') {
        if (profile.role !== 'administrador' || !profile.company_id) throw new Error('Apenas administradores podem alterar a marca.');
        const previousAssets = [company?.logo_url, company?.favicon_url].filter((value): value is string => Boolean(value));
        const { error } = await supabase.from('companies').update({
          name: brandingForm.name.trim(),
          logo_url: brandingForm.logoUrl.trim() || null,
          favicon_url: brandingForm.faviconUrl.trim() || null,
          primary_color: brandingForm.primaryColor,
          secondary_color: brandingForm.secondaryColor,
          custom_domain: brandingForm.customDomain.trim() || null
        }).eq('id', profile.company_id).select('id').single();
        if (error) throw error;
        const nextAssets = [brandingForm.logoUrl, brandingForm.faviconUrl];
        const obsoletePaths = [...new Set(previousAssets.filter((value) => !nextAssets.includes(value)).map(storagePathFromPublicUrl).filter((value): value is string => Boolean(value)))];
        if (obsoletePaths.length) await supabase.storage.from('company-branding').remove(obsoletePaths);
        window.dispatchEvent(new Event('luxcar:branding-updated'));
        showMessage('success', 'Identidade da loja atualizada.');
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
      showMessage('error', error.message || 'Não foi possível exportar os dados.');
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
      showMessage('error', error.message || 'Não foi possível limpar o cache.');
    }
  };

  const notificationRows = [
    { key: 'negotiationStatus' as const, title: 'Status da negociação', desc: 'Receber alertas quando o estágio de uma negociação mudar' },
    { key: 'linkedVehicleUpdates' as const, title: 'Veículo vinculado', desc: 'Notificar apenas sobre atualizações importantes do veículo negociado' }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Palette}
          eyebrow="Operação e identidade"
          title="Configurações"
          description="Ajuste perfil, segurança, preferências e dados operacionais da loja."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <Skeleton className="h-64 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Palette}
        eyebrow="Operação e identidade"
        title="Configurações"
        description="Ajuste perfil, segurança, preferências e dados operacionais da loja."
      />

      {message && (
        <div role={message.type === 'error' ? 'alert' : 'status'} aria-live="polite" className={cn(
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <aside className="lg:col-span-1">
            <Card className="gap-0 overflow-hidden p-1 lg:py-2">
              <TabsList className="flex w-full overflow-x-auto lg:flex-col lg:overflow-visible h-auto bg-transparent p-0 gap-1 justify-start">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 text-left justify-start transition-colors rounded-lg w-full shrink-0',
                      'data-[state=active]:bg-accent data-[state=active]:text-accent-foreground border-l-2 data-[state=active]:border-primary border-transparent'
                    )}
                  >
                    <tab.icon className="size-5 shrink-0" />
                    <span className="text-left">
                      <span className="block text-sm font-medium">{tab.label}</span>
                      <span className="hidden lg:block text-xs opacity-70 text-muted-foreground">{tab.desc}</span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
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

              {activeTab === 'branding' && (
                <div className="grid gap-6 xl:grid-cols-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm md:col-span-2">
                    <p className="font-medium">Arquivos de identidade da loja</p>
                    <p className="mt-1 text-muted-foreground">Envie imagens PNG exatamente no tamanho indicado. Máximo de 2 MB por arquivo.</p>
                  </div>
                  <div className="space-y-2"><Label htmlFor="brandName">Nome da loja</Label><Input id="brandName" value={brandingForm.name} onChange={(e) => setBrandingForm({ ...brandingForm, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="brandDomain">Domínio personalizado</Label><Input id="brandDomain" placeholder="loja.exemplo.com.br" value={brandingForm.customDomain} onChange={(e) => setBrandingForm({ ...brandingForm, customDomain: e.target.value })} /></div>
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <div><Label htmlFor="brandLogo">Logo · PNG · 512 × 256 px</Label><p className="mt-1 text-xs text-muted-foreground">Proporção horizontal 2:1, máximo 2 MB.</p></div>
                    <Input id="brandLogo" type="file" accept="image/png,.png" disabled={!!uploadingBrandAsset} onChange={(event) => { void handleBrandImageUpload('logo', event.target.files?.[0]); event.currentTarget.value = ''; }} />
                    {brandingForm.logoUrl && <img src={brandingForm.logoUrl} alt="Prévia da logo" className="h-16 max-w-full rounded-lg border border-border bg-white object-contain p-2" />}
                    {uploadingBrandAsset === 'logo' && <p role="status" className="text-xs text-muted-foreground">Validando e enviando logo…</p>}
                  </div>
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <div><Label htmlFor="brandFavicon">Favicon · PNG · 64 × 64 px</Label><p className="mt-1 text-xs text-muted-foreground">Imagem quadrada, máximo 2 MB.</p></div>
                    <Input id="brandFavicon" type="file" accept="image/png,.png" disabled={!!uploadingBrandAsset} onChange={(event) => { void handleBrandImageUpload('favicon', event.target.files?.[0]); event.currentTarget.value = ''; }} />
                    {brandingForm.faviconUrl && <img src={brandingForm.faviconUrl} alt="Prévia do favicon" className="size-12 rounded-lg border border-border bg-white object-contain p-1" />}
                    {uploadingBrandAsset === 'favicon' && <p role="status" className="text-xs text-muted-foreground">Validando e enviando favicon…</p>}
                  </div>
                  <div className="space-y-2"><Label htmlFor="brandPrimary">Cor principal</Label><Input id="brandPrimary" type="color" value={brandingForm.primaryColor} onChange={(e) => setBrandingForm({ ...brandingForm, primaryColor: e.target.value })} className="h-12" />{primaryColorWarning(brandingForm.primaryColor) && <p className="text-xs leading-5 text-[#F5B54A]">{primaryColorWarning(brandingForm.primaryColor)}</p>}</div>
                  <div className="space-y-2"><Label htmlFor="brandSecondary">Cor secundária</Label><Input id="brandSecondary" type="color" value={brandingForm.secondaryColor} onChange={(e) => setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })} className="h-12" /></div>
                  <p className="text-xs text-muted-foreground md:col-span-2">Depois do upload, clique em “Salvar alterações” para aplicar a logo e o favicon à identidade pública da concessionária.</p>
                </div>
                <section aria-label="Prévia da vitrine" className="h-fit overflow-hidden rounded-xl border border-border bg-[#F6F6F4] text-[#15171A]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#E4E4E0] bg-white px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {brandingForm.logoUrl ? <img src={brandingForm.logoUrl} alt="" className="h-8 max-w-28 rounded-md object-contain" /> : <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold" style={{ backgroundColor: brandingForm.primaryColor, color: brandingForm.secondaryColor }}>{brandingForm.name.trim().slice(0, 2).toUpperCase() || 'LC'}</span>}
                      <span className="truncate font-semibold [font-family:var(--font-display)]">{brandingForm.name || 'Nome da concessionária'}</span>
                    </div>
                    <span className="shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: brandingForm.secondaryColor }}>Falar no WhatsApp</span>
                  </div>
                  <div className="p-4 sm:p-5">
                    <h3 className="text-lg font-bold [font-family:var(--font-display)]">Estoque da loja</h3>
                    <p className="mt-1 text-sm text-[#5C626B]">Prévia das cores e da identidade visual da sua vitrine pública.</p>
                    <div className="mt-4 overflow-hidden rounded-lg border border-[#E4E4E0] bg-white">
                      <div className="flex aspect-[16/7] items-center justify-center bg-[#ECEDEA] text-[#8A8D87]"><Car className="size-9" aria-hidden="true" /></div>
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div><p className="text-sm font-semibold">Anúncios publicados pela loja</p><p className="text-xs text-[#5C626B]">Fotos, detalhes e preços do estoque ativo</p></div>
                        <span className="rounded-md px-3 py-2 text-xs font-bold" style={{ backgroundColor: brandingForm.primaryColor, color: brandingForm.secondaryColor }}>Ver detalhes</span>
                      </div>
                    </div>
                  </div>
                </section>
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
                        aria-label={row.title}
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
                      <p className="text-xs text-muted-foreground">Versão</p>
                      <p className="font-medium text-foreground">1.0.0</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Banco de dados</p>
                      <p className="font-medium text-foreground">Supabase</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Responsável</p>
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
                <Button onClick={handleSave} disabled={saving || !!uploadingBrandAsset}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={saving}
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
      </Tabs>
    </div>
  );
}



