import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertCircle, CheckCircle, LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function UpdatePassword() {
  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      setHasRecoverySession(Boolean(data.session) && !sessionError);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      setError('Não foi possível atualizar a senha. Solicite um novo link e tente novamente.');
      return;
    }
    setUpdated(true);
    setSaving(false);
    await supabase.auth.signOut();
    window.setTimeout(() => navigate('/auth/login', { replace: true }), 1800);
  }

  return (
    <Card className="shadow-lux-lg">
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-accent text-primary"><LockKeyhole className="size-5" /></div>
        <CardTitle className="text-2xl">Definir nova senha</CardTitle>
        <CardDescription>Escolha uma senha nova para sua conta LuxCar.</CardDescription>
      </CardHeader>
      <CardContent>
        {checking ? <p role="status" className="text-sm text-muted-foreground">Validando link de recuperação...</p> : null}
        {!checking && !hasRecoverySession ? (
          <div className="space-y-4">
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-destructive">Este link expirou ou já foi usado. Solicite outro para continuar.</p></div>
            <Button asChild className="w-full"><Link to="/auth/forgot-password">Solicitar novo link</Link></Button>
          </div>
        ) : null}
        {!checking && hasRecoverySession && !updated ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-destructive">{error}</p></div>}
            <div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
            <Button type="submit" disabled={saving} className="w-full" size="lg">{saving ? 'Salvando...' : 'Salvar nova senha'}</Button>
          </form>
        ) : null}
        {updated ? <div role="status" className="rounded-2xl border border-primary/20 bg-accent p-4"><p className="flex items-center gap-2 font-medium text-accent-foreground"><CheckCircle className="size-5 text-primary" />Senha atualizada.</p><p className="mt-2 text-sm text-muted-foreground">Redirecionando para o login...</p></div> : null}
      </CardContent>
    </Card>
  );
}
