import { useEffect, useRef, useState } from 'react';
import { downloadText, loadSessionFile } from '@/app/load-stream';
import { useInspector } from '@/app/store';
import { useTheme } from '@/app/use-theme';
import type { DiagnosticsReport } from '@/core/diagnostics';
import { exportRawStream, exportSession } from '@/core/session';
import { encodeShare } from '@/core/share';
import { Button } from './ui/button';
import {
  ActivityIcon,
  AlertIcon,
  CheckIcon,
  ChevronIcon,
  DownloadIcon,
  LinkIcon,
  MoonIcon,
  SunIcon,
  UploadIcon,
} from './ui/icons';
import { Kbd } from './ui/kbd';

interface HeaderProps {
  report: DiagnosticsReport;
}

export function Header({ report }: HeaderProps) {
  const [theme, toggleTheme] = useTheme();
  const frames = useInspector((s) => s.frames);
  const rawText = useInspector((s) => s.rawText);
  const source = useInspector((s) => s.source);
  const drawerOpen = useInspector((s) => s.drawerOpen);
  const setDrawerOpen = useInspector((s) => s.setDrawerOpen);
  const notify = useInspector((s) => s.notify);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const hasFrames = frames.length > 0;
  const { counts, worst } = report;

  const copyLink = async () => {
    if (!rawText) {
      notify(
        'Share links need pasted text. Export the session as JSON for live or HAR captures.',
        'error',
      );
      return;
    }
    const result = encodeShare({ text: rawText, ...(source?.label ? { name: source.label } : {}) });
    if (!result.ok) {
      notify(
        `Too large for a link (${(result.length / 1024).toFixed(0)} KB compressed, limit 30 KB). Export JSON instead.`,
        'error',
      );
      return;
    }
    const url = `${location.origin}${location.pathname}${result.hash}`;
    history.replaceState(null, '', result.hash);
    try {
      await navigator.clipboard.writeText(url);
      notify(`Link copied (${(result.length / 1024).toFixed(1)} KB).`, 'success');
    } catch {
      notify('Link is in the address bar; clipboard access was denied.', 'info');
    }
  };

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2 sm:px-4">
      <a href="#top" className="flex items-center gap-2 pr-2 text-fg no-underline">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <ActivityIcon size={18} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">SSE Stream Inspector</span>
          <span className="hidden text-[11px] text-muted sm:block">
            Inspect, replay and diff text/event-stream
          </span>
        </span>
      </a>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Button
          variant={drawerOpen ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-pressed={drawerOpen}
          aria-controls="diagnostics-drawer"
          className="min-w-10"
          title="Toggle diagnostics (d)"
        >
          {worst === null ? (
            <CheckIcon size={14} className={hasFrames ? 'text-ok' : 'text-muted'} />
          ) : (
            <AlertIcon
              size={14}
              className={
                worst === 'error'
                  ? 'text-error'
                  : worst === 'warning'
                    ? 'text-warning'
                    : 'text-info'
              }
            />
          )}
          <span className="hidden sm:inline">Diagnostics</span>
          {hasFrames && (
            <span
              className="flex items-center gap-1 font-mono text-[11px]"
              aria-label={`${counts.error} errors, ${counts.warning} warnings, ${counts.info} notes`}
            >
              {counts.error > 0 && (
                <span className={drawerOpen ? '' : 'text-error'}>{counts.error}E</span>
              )}
              {counts.warning > 0 && (
                <span className={drawerOpen ? '' : 'text-warning'}>{counts.warning}W</span>
              )}
              {counts.info > 0 && (
                <span className={drawerOpen ? '' : 'text-info'}>{counts.info}I</span>
              )}
              {worst === null && <span className={drawerOpen ? '' : 'text-ok'}>clean</span>}
            </span>
          )}
        </Button>

        <div className="relative" ref={menuRef}>
          <Button
            size="sm"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="min-w-10"
          >
            <DownloadIcon size={14} />
            <span className="hidden sm:inline">Share / Export</span>
            <ChevronIcon
              size={12}
              className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            />
          </Button>
          {menuOpen && (
            <div
              role="menu"
              className="card absolute right-0 z-30 mt-1 w-64 overflow-hidden p-1 text-sm"
            >
              <MenuItem
                icon={<LinkIcon size={14} />}
                label="Copy share link"
                hint={rawText ? 'Compressed into the URL' : 'Pasted text only'}
                disabled={!hasFrames}
                onClick={() => {
                  setMenuOpen(false);
                  void copyLink();
                }}
              />
              <MenuItem
                icon={<DownloadIcon size={14} />}
                label="Export session JSON"
                hint="Frames, timing and source"
                disabled={!hasFrames}
                onClick={() => {
                  setMenuOpen(false);
                  downloadText(
                    `sse-session-${stamp()}.json`,
                    exportSession(frames, source ?? { kind: 'paste', label: 'Untitled' }),
                  );
                }}
              />
              <MenuItem
                icon={<DownloadIcon size={14} />}
                label="Export raw stream"
                hint="text/event-stream"
                disabled={!hasFrames}
                onClick={() => {
                  setMenuOpen(false);
                  downloadText(
                    `stream-${stamp()}.txt`,
                    exportRawStream(frames),
                    'text/event-stream',
                  );
                }}
              />
              <div className="my-1 border-t border-line" />
              <MenuItem
                icon={<UploadIcon size={14} />}
                label="Import session JSON"
                hint="From a previous export"
                onClick={() => {
                  setMenuOpen(false);
                  fileRef.current?.click();
                }}
              />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import session JSON"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadSessionFile(f);
              e.target.value = '';
            }}
          />
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title="Toggle theme"
        >
          {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </Button>
      </div>
      <span className="sr-only">
        Keyboard: <Kbd>↑</Kbd> <Kbd>↓</Kbd> move between frames, <Kbd>Space</Kbd> play or pause,{' '}
        <Kbd>d</Kbd> diagnostics.
      </span>
    </header>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-panel-2 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex flex-col">
        <span>{label}</span>
        <span className="text-[11px] text-muted">{hint}</span>
      </span>
    </button>
  );
}
