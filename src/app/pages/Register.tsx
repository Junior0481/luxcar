import { FormEvent, InputHTMLAttributes, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, CheckCircle, Mail, MapPin, Phone, Store, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const emptyForm = { companyName: '', slug: '', ownerName: '', ownerEmail: '', phone: '', city: '', state: '', paymentReference: '' };
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function Register() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const { error: requestError } = await supabase.from('subscription_requests').insert({
      company_name: form.companyName.trim(),
      slug: form.slug.trim() || slugify(form.companyName),
      owner_name: form.ownerName.trim(),
      owner_email: form.ownerEmail.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim().toUpperCase() || null,
      payment_reference: form.paymentReference.trim() || null
    });
    setLoading(false);
    if (requestError) {
      setError(requestError.code === '23505' ? 'Já existe uma solicitação com este identificador. Revise o endereço da loja.' : requestError.message || 'Não foi possível enviar sua solicitação.');
      return;
    }
    setSubmitted(true);
  };

  const input = (key: keyof typeof emptyForm, label: string, Icon: typeof Store, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="pl-10" {...props} />
      </div>
    </div>
  );

  return (
    <Card className="shadow-lux-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Solicitar assinatura LuxCar</CardTitle>
        <CardDescription>Uma assinatura completa, com recursos essenciais, profissionais e white label incluídos.</CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="space-y-4 rounded-2xl border border-primary/20 bg-accent p-5">
            <div className="flex items-center gap-2 font-medium text-accent-foreground"><CheckCircle className="size-5 text-primary" /> Solicitação enviada</div>
            <p className="text-sm leading-6 text-muted-foreground">A equipe LuxCar vai conferir o pagamento. Depois da confirmação, a concessionária será configurada e o acesso de administrador será preparado para envio ao proprietário pelo email informado.</p>
          </div>
        ) : (
          <>
            {error && <div className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-destructive">{error}</p></div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {input('companyName', 'Nome da concessionária *', Store, { required: true, autoComplete: 'organization' })}
                {input('slug', 'Endereço curto (opcional)', Store, { placeholder: 'gerado pelo nome' })}
                {input('ownerName', 'Nome do proprietário *', User, { required: true, autoComplete: 'name' })}
                {input('ownerEmail', 'Email para acesso *', Mail, { type: 'email', required: true, autoComplete: 'email' })}
                {input('phone', 'Telefone', Phone, { type: 'tel', autoComplete: 'tel' })}
                {input('city', 'Cidade', MapPin, { autoComplete: 'address-level2' })}
                {input('state', 'Estado (UF)', MapPin, { maxLength: 2, autoComplete: 'address-level1' })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentReference">Referência do pagamento (opcional)</Label>
                <Input id="paymentReference" value={form.paymentReference} onChange={(event) => setForm({ ...form, paymentReference: event.target.value })} placeholder="Ex.: nome do pagador ou identificador da transferência" />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">O acesso só será criado depois que a equipe confirmar o recebimento. Não informe senha neste formulário.</p>
              <Button type="submit" disabled={loading} className="w-full" size="lg">{loading ? 'Enviando solicitação...' : 'Enviar solicitação'}</Button>
            </form>
          </>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">Já recebeu acesso? <Link to="/auth/login" className="font-medium text-primary hover:underline">Entrar</Link></p>
      </CardContent>
    </Card>
  );
}
