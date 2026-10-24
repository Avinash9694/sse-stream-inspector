import type { Frame } from '@/core/frame';
import { extractSseEntries, type HarSseEntry } from '@/core/har';
import { importSession, type SessionSource } from '@/core/session';
import { parseTextAsync } from '@/worker/parse-client';
import { useInspector } from './store';

export async function loadText(text: string, source: SessionSource): Promise<void> {
  const store = useInspector.getState();
  if (!text.trim()) {
    store.failLoad('Nothing to parse — paste a text/event-stream body first.');
    return;
  }
  store.beginLoad();
  try {
    const { frames, ms } = await parseTextAsync(text);
    useInspector.getState().setFrames(frames, source, text, ms);
    if (frames.length === 0)
      useInspector
        .getState()
        .failLoad('No SSE blocks found. Frames are separated by a blank line.');
  } catch (err) {
    useInspector.getState().failLoad(err instanceof Error ? err.message : 'Parse failed.');
  }
}

export function loadFrames(frames: Frame[], source: SessionSource): void {
  useInspector.getState().setFrames(frames, source, null);
}

export async function loadSessionFile(file: File): Promise<void> {
  const store = useInspector.getState();
  store.beginLoad();
  try {
    const session = importSession(await file.text());
    useInspector
      .getState()
      .setFrames(
        session.frames,
        { ...session.source, label: `${session.source.label} (imported)` },
        null,
      );
  } catch (err) {
    useInspector.getState().failLoad(err instanceof Error ? err.message : 'Import failed.');
  }
}

export async function readHarFile(file: File): Promise<HarSseEntry[]> {
  return extractSseEntries(await file.text());
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
