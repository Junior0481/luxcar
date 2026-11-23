import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Run with: node --env-file=.env.local scripts/create-demo-accesses.mjs [--apply]
// Set either DEMO_COMPANY_ID or DEMO_COMPANY_NAME (and optionally DEMO_COMPANY_SLUG).
// Without --apply, this validates the target and prints a preview without creating records.
const required = [
  'DEMO_ADMIN_NAME', 'DEMO_ADMIN_EMAIL',
  'DEMO_SELLER_NAME', 'DEMO_SELLER_EMAIL',
  'DEMO_CLIENT_NAME', 'DEMO_CLIENT_EMAIL'
];
const missing = required.filter((key) => !process.env[key]);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) missing.push('SUPABASE_URL (ou VITE_SUPABASE_URL)');
if (!adminKey) missing.push('SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY legado)');
const companyId = process.env.DEMO_COMPANY_ID?.trim();
const companyName = process.env.DEMO_COMPANY_NAME?.trim();
const slugify = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const companySlug = process.env.DEMO_COMPANY_SLUG?.trim() || (companyName ? slugify(companyName) : '');

if ((!companyId && !companyName) || (companyId && companyName)) {
  missing.push('informe somente DEMO_COMPANY_ID ou DEMO_COMPANY_NAME');
}
if (missing.length) {
  throw new Error(`Defina estas variáveis antes de executar: ${missing.join(', ')}`);
}

if (companyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
  throw new Error('DEMO_COMPANY_ID precisa ser um UUID válido.');
}
if (!companyId && !companySlug) throw new Error('DEMO_COMPANY_SLUG inválido.');

const accounts = [
  { name: process.env.DEMO_ADMIN_NAME.trim(), email: process.env.DEMO_ADMIN_EMAIL.trim().toLowerCase(), role: 'administrador' },
  { name: process.env.DEMO_SELLER_NAME.trim(), email: process.env.DEMO_SELLER_EMAIL.trim().toLowerCase(), role: 'vendedor' },
  { name: process.env.DEMO_CLIENT_NAME.trim(), email: process.env.DEMO_CLIENT_EMAIL.trim().toLowerCase(), role: 'cliente' }
];

if (new Set(accounts.map(({ email }) => email)).size !== accounts.length) {
  throw new Error('Use um email diferente para cada acesso.');
}

const supabase = createClient(supabaseUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

let company;
let staffCount = 0;
const createCompany = !companyId;

if (createCompany) {
  const [{ data: sameSlug, error: slugError }, { data: sameName, error: nameError }] = await Promise.all([
    supabase.from('companies').select('id, name').eq('slug', companySlug).maybeSingle(),
    supabase.from('companies').select('id, name').eq('name', companyName).maybeSingle()
  ]);
  if (slugError || nameError) throw new Error(`Não foi possível validar a nova loja: ${slugError?.message || nameError?.message}`);
  if (sameSlug || sameName) throw new Error(`Já existe uma loja com esse nome ou endereço: ${sameSlug?.name || sameName?.name}. Use DEMO_COMPANY_ID para adicionar acessos a ela.`);
  company = { id: null, name: companyName, status: 'active', max_users: 5 };
} else {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, status, max_users')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível validar a loja: ${error.message}`);
  if (!data) throw new Error('Loja não encontrada. Confira DEMO_COMPANY_ID.');
  if (data.status !== 'active') throw new Error(`A loja ${data.name} não está ativa (status: ${data.status}).`);
  company = data;

  const { count, error: countError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  if (countError) throw new Error(`Não foi possível verificar o limite de usuários: ${countError.message}`);
  staffCount = count || 0;
}

if (staffCount + 2 > company.max_users) {
  throw new Error(`A loja atingiria o limite do plano: ${staffCount} usuários atuais, limite ${company.max_users}, 2 novos acessos internos.`);
}

const existingEmails = new Set();
for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(`Não foi possível verificar os emails: ${error.message}`);
  for (const user of data.users) {
    if (user.email) existingEmails.add(user.email.toLowerCase());
  }
  if (data.users.length < 1000) break;
}

const conflicts = accounts.filter(({ email }) => existingEmails.has(email));
if (conflicts.length) throw new Error(`Já existem contas com estes emails: ${conflicts.map(({ email }) => email).join(', ')}`);

console.log(`${createCompany ? 'Nova empresa' : 'Loja validada'}: ${company.name}${createCompany ? ` (slug: ${companySlug})` : ''}`);
console.log('Contas planejadas:');
for (const { name, email, role } of accounts) console.log(`- ${role}: ${name} <${email}>`);

if (!process.argv.includes('--apply')) {
  console.log('\nPrévia concluída; nenhum registro foi criado. Revise os dados e execute novamente com --apply.');
} else {
  const createdIds = [];
  const credentials = [];
  let createdCompanyId = null;

  try {
    let targetCompanyId = companyId;
    if (createCompany) {
      const startedAt = new Date();
      const periodEnd = new Date(startedAt);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
      const { data, error } = await supabase.from('companies').insert({
        name: companyName,
        slug: companySlug,
        email: accounts[0].email,
        status: 'active',
        plan: 'silver',
        max_vehicles: 25,
        max_users: 6,
        subscription_status: 'active',
        billing_cycle: 'monthly',
        subscription_started_at: startedAt.toISOString(),
        current_period_end: periodEnd.toISOString()
      }).select('id').single();
      if (error) throw new Error(`Falha ao criar a empresa: ${error.message}`);
      targetCompanyId = data.id;
      createdCompanyId = data.id;
    }

    for (const account of accounts) {
      const password = randomBytes(24).toString('base64url');
      const isCustomer = account.role === 'cliente';
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: isCustomer
          ? { full_name: account.name, user_type: 'customer' }
          : { full_name: account.name, role: account.role, company_id: targetCompanyId }
      });

      if (error) throw new Error(`Falha ao criar ${account.role} (${account.email}): ${error.message}`);
      createdIds.push(data.user.id);
      credentials.push({ role: account.role, name: account.name, email: account.email, temporary_password: password });
      if (!isCustomer) {
        const { data: profile, error: profileError } = await supabase.from('profiles')
          .update({ full_name: account.name, role: account.role, company_id: targetCompanyId })
          .eq('id', data.user.id)
          .select('id')
          .single();
        if (profileError || !profile) throw new Error(`Não foi possível configurar o perfil ${account.role}: ${profileError?.message || 'perfil ausente'}`);
      }
      if (account.role === 'administrador' && createCompany) {
        const { error: ownerError } = await supabase.from('companies').update({ owner_user_id: data.user.id }).eq('id', targetCompanyId);
        if (ownerError) throw new Error(`Conta criada, mas não foi possível vincular o proprietário: ${ownerError.message}`);
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const id of createdIds.reverse()) {
      const { error: rollbackError } = await supabase.auth.admin.deleteUser(id);
      if (rollbackError) rollbackErrors.push(rollbackError.message);
    }
    if (createdCompanyId) {
      const { error: companyRollbackError } = await supabase.from('companies').delete().eq('id', createdCompanyId);
      if (companyRollbackError) rollbackErrors.push(companyRollbackError.message);
    }
    if (rollbackErrors.length) {
      throw new Error(`${error.message} A limpeza também falhou: ${rollbackErrors.join('; ')}`);
    }
    throw error;
  }

  console.log(`\n${createCompany ? 'Empresa e contas criadas' : 'Contas criadas'}. Guarde e compartilhe as senhas temporárias por um canal seguro:`);
  console.log(JSON.stringify({ company: company.name, slug: companySlug || undefined, accounts: credentials }, null, 2));
}
