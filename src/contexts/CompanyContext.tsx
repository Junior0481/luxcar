import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Company, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type CompanyContextValue = {
  company: Company | null;
  loading: boolean;
};

const CompanyContext = createContext<CompanyContextValue>({ company: null, loading: true });

function applyBranding(company: Company | null) {
  if (!company) return;
  document.title = company.name;
  if (company.primary_color) document.documentElement.style.setProperty('--primary', company.primary_color);
  if (company.secondary_color) document.documentElement.style.setProperty('--secondary', company.secondary_color);

  if (company.favicon_url) {
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = company.favicon_url;
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadCompany() {
      setLoading(true);
      const host = window.location.hostname;
      const source = profile?.company_id ? 'companies' : 'public_company_branding';
      let query = supabase.from(source).select('*');

      if (profile?.company_id) query = query.eq('id', profile.company_id);
      else if (!['localhost', '127.0.0.1', 'luxcar-six.vercel.app'].includes(host)) query = query.eq('custom_domain', host);
      else query = query.eq('slug', import.meta.env.VITE_DEFAULT_COMPANY_SLUG || 'luxcar');

      const { data } = await query.maybeSingle();
      if (!active) return;
      const nextCompany = (data as Company | null) || null;
      setCompany(nextCompany);
      applyBranding(nextCompany);
      setLoading(false);
    }

    loadCompany();
    const refresh = () => loadCompany();
    window.addEventListener('luxcar:branding-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('luxcar:branding-updated', refresh);
    };
  }, [profile?.company_id]);

  return <CompanyContext.Provider value={{ company, loading }}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  return useContext(CompanyContext);
}
