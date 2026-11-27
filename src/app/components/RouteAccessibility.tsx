import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

const BRAND_FALLBACK = 'LuxCar';

const brandTitle = () => document.documentElement.dataset.brandTitle || BRAND_FALLBACK;

const pageTitle = (heading: HTMLElement | null) => {
  const text = heading?.textContent?.trim();
  return text && text !== brandTitle() ? `${text} · ${brandTitle()}` : brandTitle();
};

/** Nome da loja usado no fim do título da página (definido pelo branding). */
export function setBrandTitle(name: string | undefined) {
  if (!name) return;
  document.documentElement.dataset.brandTitle = name;
  document.title = pageTitle(document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1'));
}

const focusMain = () => {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return;
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  main.focus();
};

/**
 * Em cada troca de rota do SPA: título da aba a partir do h1 da página e, depois da primeira
 * carga, foco no h1 para o leitor de tela anunciar a nova página (WCAG 2.4.2 e 2.4.3).
 * Também oferece o link "Pular para o conteúdo" (WCAG 2.4.1).
 */
export function RouteAccessibility() {
  const { pathname } = useLocation();
  const firstLoad = useRef(true);

  useEffect(() => {
    const moveFocus = !firstLoad.current;
    firstLoad.current = false;
    let attempts = 0;
    // As páginas carregam sob demanda: espera o h1 aparecer (até ~3s).
    const timer = window.setInterval(() => {
      attempts += 1;
      const heading = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1');
      if (!heading && attempts < 30) return;
      window.clearInterval(timer);
      document.title = pageTitle(heading);
      if (!moveFocus || !heading) return;
      // Não rouba o foco de quem já está digitando ou num diálogo.
      const active = document.activeElement;
      if (active && active !== document.body && active.closest('[role="dialog"], input, textarea, select')) return;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }, 100);
    return () => window.clearInterval(timer);
  }, [pathname]);

  return (
    <a
      href="#conteudo"
      onClick={(event) => { event.preventDefault(); focusMain(); }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lux-md"
    >
      Pular para o conteúdo
    </a>
  );
}
