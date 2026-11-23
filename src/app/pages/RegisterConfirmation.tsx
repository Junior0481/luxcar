import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertCircle, CheckCircle2, CreditCard, LoaderCircle, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

type RegistrationDraft = Record<string, unknown> & { owner_email?: string };
const registrationDraftKey = 'luxcar-registration-draft';

export function RegisterConfirmation() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Estamos validando o link e registrando sua solicitação.');
  const [canRetry, setCanRetry] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
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
    // Online payment: once AbacatePay confirms, the store is created and this email becomes the administrator.
    const { data: charge } = await supabase.functions.invoke('create-charge', { body: { kind: 'signup' } });
    setStatus('success');
    if (charge?.url) {
      setCheckoutUrl(charge.url);
      setMessage(`Email confirmado. Pague ${Number(charge.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para liberar sua loja. Assim que o pagamento for confirmado, o acesso de administrador é criado automaticamente para este email; entre pelo login com "Esqueci minha senha" para definir a senha.`);
    } else {
      setMessage('Email confirmado. A equipe LuxCar vai conferir a solicitação e confirmar o pagamento pelo painel. Depois, o acesso de administrador será preparado.');
    }
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
        {status === 'success' && <div className="flex flex-wrap gap-3">
          {checkoutUrl && <Button type="button" asChild><a href={checkoutUrl}><CreditCard className="mr-2 size-4" /> Ir para o pagamento</a></Button>}
          <Button type="button" variant="outline" asChild><Link to="/">Ir para o início</Link></Button>
        </div>}
      </CardContent>
    </Card>
  );
}
