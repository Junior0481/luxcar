import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Company, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type CachedBranding = { name?: string; primaryColor?: string; secondaryColor?: string; faviconUrl?: string };
const brandingCacheKey = (host: string, userId?: string) => userId ? `luxcar:branding:user:${userId}` : `luxcar:branding:host:${host}`;

function readBrandingCache(key: string): CachedBranding | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as CachedBranding : null;
  } catch {
    return null;
  }
}

type CompanyContextValue = {
  company: Company | null;
  loading: boolean;
};

const CompanyContext = createContext<CompanyContextValue>({ company: null, loading: true });

function getContrastForeground(hex: string): string {
  const clean = hex.replace('#', '').trim();
  let r = 0, g = 0, b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  } else {
    return '#ffffff';
  }
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#0a0a0b' : '#ffffff';
}

function applyBranding(company: { name?: string; primary_color?: string; secondary_color?: string; favicon_url?: string } | null) {
  if (!company) return;
  if (company.name) document.title = company.name;
  if (company.primary_color) {
    document.documentElement.style.setProperty('--primary', company.primary_color);
    document.documentElement.style.setProperty('--primary-foreground', getContrastForeground(company.primary_color));
  }
  if (company.secondary_color) {
    document.documentElement.style.setProperty('--secondary', company.secondary_color);
    document.documentElement.style.setProperty('--secondary-foreground', getContrastForeground(company.secondary_color));
  }

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
  const { profile, user, loading: authLoading } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadCompany() {
      if (authLoading) return;
      setLoading(true);
      const host = window.location.hostname;
      const cacheKey = brandingCacheKey(host, user?.id);
      const cached = readBrandingCache(cacheKey);
      if (cached) applyBranding({ name: cached.name, primary_color: cached.primaryColor, secondary_color: cached.secondaryColor, favicon_url: cached.faviconUrl });
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
      if (nextCompany) {
        const nextCache: CachedBranding = { name: nextCompany.name, primaryColor: nextCompany.primary_color, secondaryColor: nextCompany.secondary_color, faviconUrl: nextCompany.favicon_url };
        try { localStorage.setItem(cacheKey, JSON.stringify(nextCache)); } catch { /* Storage can be disabled or full. */ }
      }
      setLoading(false);
    }

    loadCompany();
    const refresh = () => loadCompany();
    window.addEventListener('luxcar:branding-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('luxcar:branding-updated', refresh);
    };
  }, [profile?.company_id, user?.id, authLoading]);

  return <CompanyContext.Provider value={{ company, loading }}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  return useContext(CompanyContext);
}
