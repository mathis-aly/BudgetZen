'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSandbox } from './SandboxContext';

interface TerminalLine {
  id: number;
  kind: 'input' | 'info' | 'warn' | 'error' | 'muted';
  text: string;
}

const INITIAL_LINES: TerminalLine[] = [
  {
    id: 1,
    kind: 'muted',
    text: 'BudgetZen Dev Console v1.0 · Swiss Editorial Runtime',
  },
  {
    id: 2,
    kind: 'muted',
    text: 'Tapez "help" pour afficher les commandes disponibles.',
  },
];

export function DevConsole() {
  const {
    isSandbox,
    isPlanningOpen,
    enterPlanning,
    exitPlanning,
    navigateShell,
    isConsoleOpen,
    setConsoleOpen,
    enterSandbox,
    resetSandbox,
    exitSandbox,
  } = useSandbox();

  const [lines, setLines] = useState<TerminalLine[]>(INITIAL_LINES);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lineIdRef = useRef(10);

  const appendLines = (
    entries: Array<{ kind: TerminalLine['kind']; text: string }>
  ) => {
    setLines((prev) => [
      ...prev,
      ...entries.map((entry) => {
        lineIdRef.current += 1;
        return { id: lineIdRef.current, kind: entry.kind, text: entry.text };
      }),
    ]);
  };

  useEffect(() => {
    if (!isConsoleOpen) return;
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isConsoleOpen]);

  useEffect(() => {
    if (!isConsoleOpen) return;
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setConsoleOpen(false);
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [isConsoleOpen, setConsoleOpen]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, isConsoleOpen]);

  const executeCommand = (raw: string) => {
    const trimmed = raw.trim();
    const cmd = trimmed.toLowerCase();

    if (!cmd) return;

    setHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
    setHistoryCursor(-1);
    setCommand('');

    appendLines([{ kind: 'input', text: `budgetzen@local:~$ ${trimmed}` }]);

    switch (cmd) {
      case 'help': {
        appendLines([
          { kind: 'info', text: 'Commandes disponibles :' },
          {
            kind: 'muted',
            text: '  test           Bascule en Mode Test isolé (aucune écriture SQLite) + tutoriel',
          },
          {
            kind: 'muted',
            text: '  reset          Remet l’état en mémoire du Mode Test à 0 €',
          },
          {
            kind: 'muted',
            text: '  planification  Ouvre le canevas éditorial de planification (cartes & liens)',
          },
          {
            kind: 'muted',
            text: '  projets        Ouvre le module Projets & Financements (alias: projects)',
          },
          {
            kind: 'muted',
            text: '  exit | prod    Quitte le Mode Test ou Planification et revient à la prod',
          },
          {
            kind: 'muted',
            text: '  clear          Efface la sortie du terminal',
          },
          {
            kind: 'muted',
            text: '  help           Affiche cette aide',
          },
        ]);
        break;
      }

      case 'test': {
        appendLines([
          {
            kind: 'warn',
            text: '[SANDBOX] Clonage en mémoire initialisé · Isolation SQLite active.',
          },
        ]);
        enterSandbox();
        break;
      }

      case 'reset': {
        if (isSandbox) {
          resetSandbox();
          appendLines([
            {
              kind: 'warn',
              text: '[SANDBOX] État en mémoire intégralement remis à 0 € (SQLite intact).',
            },
          ]);
        } else {
          appendLines([
            {
              kind: 'info',
              text: '[INFO] La commande "reset" n’est disponible qu’en Mode Test ("test").',
            },
          ]);
        }
        break;
      }

      case 'planification': {
        appendLines([
          {
            kind: 'info',
            text: '[PLANIFICATION] Ouverture du canevas éditorial ML…',
          },
        ]);
        enterPlanning();
        break;
      }

      case 'projets':
      case 'projects': {
        if (isPlanningOpen) {
          exitPlanning();
        }
        appendLines([
          {
            kind: 'info',
            text: '[PROJETS] Ouverture du module Projets & Financements…',
          },
        ]);
        navigateShell('projects');
        setConsoleOpen(false);
        break;
      }

      case 'prod': {
        if (isPlanningOpen) {
          exitPlanning();
        }
        if (isSandbox) {
          appendLines([
            {
              kind: 'info',
              text: '[PROD] Mode Test fermé — retour sur la base SQLite réelle.',
            },
          ]);
          exitSandbox();
        } else if (!isPlanningOpen) {
          appendLines([
            {
              kind: 'info',
              text: '[PROD] Environnement SQLite réel déjà actif.',
            },
          ]);
        }
        break;
      }

      case 'exit': {
        if (isPlanningOpen) {
          exitPlanning();
          break;
        }
        if (isSandbox) {
          appendLines([
            {
              kind: 'info',
              text: '[PROD] Mode Test fermé — données SQLite réelles restaurées.',
            },
          ]);
          exitSandbox();
        } else {
          setConsoleOpen(false);
        }
        break;
      }

      case 'clear': {
        setLines([]);
        break;
      }

      default: {
        appendLines([
          {
            kind: 'error',
            text: `[ERR] Commande inconnue : "${trimmed}". Tapez "help".`,
          },
        ]);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setConsoleOpen(false);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (history.length === 0) return;
      event.preventDefault();
      const nextIdx = Math.min(historyCursor + 1, history.length - 1);
      setHistoryCursor(nextIdx);
      setCommand(history[nextIdx]);
      return;
    }

    if (event.key === 'ArrowDown') {
      if (historyCursor <= -1) return;
      event.preventDefault();
      const nextIdx = historyCursor - 1;
      setHistoryCursor(nextIdx);
      setCommand(nextIdx >= 0 ? history[nextIdx] : '');
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    executeCommand(command);
  };

  return (
    <AnimatePresence>
      {isConsoleOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => setConsoleOpen(false)}
          className="fixed inset-0 z-[75] bg-[#111110]/70 flex items-start justify-center pt-[10vh] sm:pt-[14vh] px-3 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Console développeur BudgetZen"
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#111110] text-[#F7F6F2] border border-[#2A2A27] rounded-sm font-mono tabular-nums overflow-hidden"
          >
            {/* Terminal Masthead */}
            <div className="px-4 py-2.5 border-b border-[#2A2A27] flex items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[#9A9890] uppercase tracking-wider font-semibold">
                  BUDGETZEN // DEV CONSOLE
                </span>
                <span
                  className={
                    isSandbox
                      ? 'px-1.5 py-0.5 bg-[#B45309] text-[#F7F6F2] rounded-[2px] text-[10px] font-semibold tracking-wide'
                      : 'px-1.5 py-0.5 bg-[#1D1D1B] border border-[#2A2A27] text-[#E2E0D8] rounded-[2px] text-[10px] font-semibold tracking-wide'
                  }
                >
                  {isSandbox ? 'SANDBOX · MÉMOIRE' : 'PROD · SQLITE'}
                </span>
                {isPlanningOpen && (
                  <span className="hidden sm:inline-block px-1.5 py-0.5 border border-[#F59E0B]/40 text-[#F59E0B] rounded-[2px] text-[10px]">
                    PLANIFICATION
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setConsoleOpen(false)}
                className="text-[10px] text-[#9A9890] hover:text-[#F7F6F2] border border-[#2A2A27] px-1.5 py-0.5 rounded-[2px] transition-colors shrink-0"
              >
                ESC
              </button>
            </div>

            {/* Scrollable Output */}
            <div
              ref={scrollRef}
              onClick={() => inputRef.current?.focus()}
              className="p-4 h-60 sm:h-64 overflow-y-auto space-y-1.5 text-xs leading-relaxed cursor-text"
            >
              {lines.map((line) => (
                <div
                  key={line.id}
                  className={
                    line.kind === 'input'
                      ? 'text-[#F7F6F2]'
                      : line.kind === 'warn'
                        ? 'text-[#F59E0B]'
                        : line.kind === 'error'
                          ? 'text-[#F87171]'
                          : line.kind === 'info'
                            ? 'text-[#E2E0D8]'
                            : 'text-[#9A9890]'
                  }
                >
                  {line.text}
                </div>
              ))}
            </div>

            {/* Command Prompt Input */}
            <form
              onSubmit={handleSubmit}
              className="px-4 py-3 border-t border-[#2A2A27] bg-[#161614] flex items-center gap-2 text-xs"
            >
              <span className="text-[#F59E0B] font-semibold shrink-0 select-none">
                budgetzen@local:~$
              </span>
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="test | planification | projets | exit | help"
                aria-label="Invite de commande développeur"
                className="w-full bg-transparent text-[#F7F6F2] placeholder:text-[#6B6962] focus:outline-none font-mono tabular-nums"
              />
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
