import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertCircle, CheckCircle2, LoaderCircle, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

type RegistrationDraft = Record<string, unknown> & { owner_email?: string };
const registrationDraftKey = 'luxcar-registration-draft';

export function RegisterConfirmation() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Estamos validando o link e registrando sua solicitação.');
  const [canRetry, setCanRetry] = useState(false);
  const navigate = useNavigate();

  const completeRegistration = useCallback(async () => {
    setStatus('processing');
    setMessage('Estamos validando o link e registrando sua solicitação.');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const draftValue = localStorage.getItem(registrationDraftKey);
    let draft: RegistrationDraft | null = null;
    try {
      draft = draftValue ? JSON.parse(draftValue) as RegistrationDraft : null;
    } catch {
      draft = null;
    }

    if (sessionError || !session?.user.email_confirmed_at || !draft?.owner_email) {
      if (session) await supabase.auth.signOut();
      setStatus('error');
      setMessage('O link expirou ou os dados do cadastro não estão neste navegador. Volte ao cadastro e solicite outro link.');
      return;
    }
    if (session.user.email?.trim().toLowerCase() !== draft.owner_email.trim().toLowerCase()) {
      await supabase.auth.signOut();
      setStatus('error');
      setMessage('O email confirmado não corresponde ao cadastro aberto neste navegador.');
      return;
    }
    setCanRetry(true);

    const { error } = await supabase.functions.invoke('subscription-register', { body: draft });
    if (error) {
      let responseError: string | undefined;
      const response = (error as { context?: Response }).context;
      if (response) responseError = (await response.clone().json().catch(() => null))?.error;
      setStatus('error');
      setMessage(responseError || error.message || 'Não foi possível concluir o cadastro. Tente novamente.');
      return;
    }

    localStorage.removeItem(registrationDraftKey);
    setStatus('success');
    setMessage('Email confirmado. A equipe LuxCar vai conferir a solicitação e confirmar o pagamento pelo painel. Depois, o acesso de administrador será preparado.');
    await supabase.auth.signOut();
  }, []);

  useEffect(() => { void completeRegistration(); }, [completeRegistration]);

  return (
    <Card className="w-full shadow-lux-lg">
      <CardHeader>
        <CardTitle className="text-2xl">{status === 'success' ? 'Solicitação enviada' : 'Confirmação de email'}</CardTitle>
        <CardDescription>Cadastro de assinatura LuxCar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div role={status === 'error' ? 'alert' : 'status'} className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
          {status === 'processing' ? <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />
            : status === 'success' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              : <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />}
          <p className="text-sm leading-6 text-foreground/80">{message}</p>
        </div>
        {status === 'error' && <div className="flex flex-wrap gap-3">
          {canRetry && <Button type="button" onClick={() => void completeRegistration()}><Mail className="mr-2 size-4" /> Tentar novamente</Button>}
          <Button type="button" variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate('/auth/register', { replace: true }); }}>Voltar ao cadastro</Button>
        </div>}
        {status === 'success' && <Button type="button" variant="outline" asChild><Link to="/">Ir para o início</Link></Button>}
      </CardContent>
    </Card>
  );
}
