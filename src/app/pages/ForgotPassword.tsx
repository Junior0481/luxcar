import { FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, CheckCircle, LockKeyhole, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/update-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (resetError) {
      setError(/redirect.*not allowed|not allowed.*redirect/i.test(resetError.message)
        ? 'O endereço de recuperação ainda não está liberado no Supabase. Adicione este endereço às URLs de redirecionamento permitidas: ' + redirectTo
        : 'Não foi possível enviar o email de recuperação. Confira o endereço e tente novamente.');
      return;
    }
    setSent(true);
  }

  return (
    <Card className="shadow-lux-lg">
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-accent text-primary"><LockKeyhole className="size-5" /></div>
        <CardTitle className="text-2xl">Recuperar senha</CardTitle>
        <CardDescription>Informe o email da conta. Enviaremos um link seguro para definir uma nova senha.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-destructive">{error}</p></div>}
        {sent ? (
          <div role="status" className="space-y-4 rounded-2xl border border-primary/20 bg-accent p-4">
            <p className="flex items-center gap-2 font-medium text-accent-foreground"><CheckCircle className="size-5 text-primary" />Se o email estiver cadastrado, enviaremos um link de recuperação.</p>
            <p className="text-sm text-muted-foreground">Confira sua caixa de entrada e spam. O link leva ao formulário para criar e confirmar a nova senha.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" placeholder="seu@email.com" /></div>
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">{loading ? 'Enviando...' : 'Enviar link de recuperação'}</Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground"><Link to="/auth/login" className="font-medium text-primary hover:underline">Voltar ao login</Link></p>
      </CardContent>
    </Card>
  );
}
