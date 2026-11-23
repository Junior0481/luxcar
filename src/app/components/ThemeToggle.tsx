import { useEffect, useState, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

const REVEAL_MS = 520;
const REVEAL_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Evita mismatch de hidratação: só renderiza o ícone depois de montar
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next = isDark ? 'light' : 'dark';
    const apply = () => {
      // Aplica a classe na hora para a View Transition capturar o tema novo; o next-themes persiste em seguida.
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.classList.toggle('light', next === 'light');
      document.documentElement.style.colorScheme = next;
      flushSync(() => setTheme(next));
    };

    const doc = document as ViewTransitionDocument;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduceMotion) {
      apply();
      return;
    }

    // Círculo que nasce no botão e cobre a tela com o tema novo.
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = doc.startViewTransition(apply);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: REVEAL_MS, easing: REVEAL_EASING, pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  };

  return (
    <button
      type="button"
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      onClick={toggle}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors ${className}`}
    >
      <span key={mounted && isDark ? 'sun' : 'moon'} className="theme-toggle-icon inline-flex">
        {mounted && isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </span>
    </button>
  );
}
