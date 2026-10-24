import { create } from 'zustand';
import { DEFAULT_DIAGNOSTICS_OPTIONS, type DiagnosticsOptions } from '@/core/diagnostics';
import type { Frame } from '@/core/frame';
import type { SessionSource } from '@/core/session';
import type { LiveStatus } from './live-connection';

export type SourceTab = 'paste' | 'live' | 'har';

export interface Notice {
  id: number;
  tone: 'info' | 'error' | 'success';
  text: string;
}

export interface InspectorState {
  frames: Frame[];
  source: SessionSource | null;
  /** Original text for paste-based loads; enables share links. */
  rawText: string | null;
  loading: boolean;
  loadError: string | null;
  parseMs: number | null;

  selected: number | null;
  /** Event names to show; null shows every event. */
  eventFilter: string[] | null;
  search: string;
  /** Frames a diagnostic pointed at, drawn with a highlight. */
  highlighted: number[];
  highlightLabel: string | null;

  /** Number of frames revealed by replay; null when not replaying (all frames shown). */
  replayCursor: number | null;
  followReplay: boolean;

  drawerOpen: boolean;
  sourceCollapsed: boolean;
  sourceTab: SourceTab;
  pasteText: string;
  pasteSampleId: string;
  options: DiagnosticsOptions;

  live: { status: LiveStatus; detail: string | null; bytes: number };
  notice: Notice | null;

  beginLoad: () => void;
  failLoad: (message: string) => void;
  setFrames: (
    frames: Frame[],
    source: SessionSource,
    rawText: string | null,
    parseMs?: number,
  ) => void;
  appendFrames: (frames: Frame[]) => void;
  clear: () => void;

  select: (index: number | null) => void;
  setEventFilter: (events: string[] | null) => void;
  toggleEvent: (event: string) => void;
  setSearch: (q: string) => void;
  focusDiagnostic: (frames: number[], label: string) => void;
  clearHighlight: () => void;

  setReplayCursor: (cursor: number | null) => void;
  setFollowReplay: (follow: boolean) => void;

  setDrawerOpen: (open: boolean) => void;
  setSourceCollapsed: (collapsed: boolean) => void;
  setSourceTab: (tab: SourceTab) => void;
  setPasteText: (text: string, sampleId?: string) => void;
  setOptions: (patch: Partial<DiagnosticsOptions>) => void;

  setLive: (status: LiveStatus, detail?: string | null) => void;
  setLiveBytes: (bytes: number) => void;
  notify: (text: string, tone?: Notice['tone']) => void;
  dismissNotice: () => void;
}

let noticeId = 0;

export const useInspector = create<InspectorState>((set, get) => ({
  frames: [],
  source: null,
  rawText: null,
  loading: false,
  loadError: null,
  parseMs: null,

  selected: null,
  eventFilter: null,
  search: '',
  highlighted: [],
  highlightLabel: null,

  replayCursor: null,
  followReplay: true,

  drawerOpen: false,
  sourceCollapsed: false,
  sourceTab: 'paste',
  pasteText: '',
  pasteSampleId: '',
  options: DEFAULT_DIAGNOSTICS_OPTIONS,

  live: { status: 'idle', detail: null, bytes: 0 },
  notice: null,

  beginLoad: () => set({ loading: true, loadError: null }),
  failLoad: (message) => set({ loading: false, loadError: message }),
  setFrames: (frames, source, rawText, parseMs) =>
    set({
      frames,
      source,
      rawText,
      loading: false,
      loadError: null,
      parseMs: parseMs ?? null,
      selected: frames.length ? 0 : null,
      eventFilter: null,
      search: '',
      highlighted: [],
      highlightLabel: null,
      replayCursor: null,
    }),
  appendFrames: (incoming) => {
    if (incoming.length === 0) return;
    const { frames, selected } = get();
    const next = frames.concat(incoming);
    set({ frames: next, selected: selected ?? 0, loading: false });
  },
  clear: () =>
    set({
      frames: [],
      source: null,
      rawText: null,
      loadError: null,
      parseMs: null,
      selected: null,
      eventFilter: null,
      search: '',
      highlighted: [],
      highlightLabel: null,
      replayCursor: null,
    }),

  select: (index) => set({ selected: index }),
  setEventFilter: (events) => set({ eventFilter: events }),
  toggleEvent: (event) => {
    const { eventFilter, frames } = get();
    const all = [...new Set(frames.map((f) => f.event))];
    const current = eventFilter ?? all;
    const next = current.includes(event) ? current.filter((e) => e !== event) : [...current, event];
    set({ eventFilter: next.length === all.length ? null : next });
  },
  setSearch: (q) => set({ search: q }),
  focusDiagnostic: (frameIdx, label) =>
    set({
      highlighted: frameIdx,
      highlightLabel: label,
      selected: frameIdx[0] ?? get().selected,
      eventFilter: null,
      search: '',
      replayCursor: null,
    }),
  clearHighlight: () => set({ highlighted: [], highlightLabel: null }),

  setReplayCursor: (cursor) => set({ replayCursor: cursor }),
  setFollowReplay: (follow) => set({ followReplay: follow }),

  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setSourceCollapsed: (collapsed) => set({ sourceCollapsed: collapsed }),
  setSourceTab: (tab) => set({ sourceTab: tab }),
  setPasteText: (text, sampleId = '') => set({ pasteText: text, pasteSampleId: sampleId }),
  setOptions: (patch) => set({ options: { ...get().options, ...patch } }),

  setLive: (status, detail = null) => set((s) => ({ live: { ...s.live, status, detail } })),
  setLiveBytes: (bytes) => set((s) => ({ live: { ...s.live, bytes } })),
  notify: (text, tone = 'info') => set({ notice: { id: ++noticeId, tone, text } }),
  dismissNotice: () => set({ notice: null }),
}));

/** Frames currently on screen: replay-limited, then filtered by event and search. */
export function selectVisibleFrames(
  state: Pick<InspectorState, 'frames' | 'replayCursor' | 'eventFilter' | 'search'>,
): Frame[] {
  const { frames, replayCursor, eventFilter, search } = state;
  const limit = replayCursor ?? frames.length;
  const base = limit >= frames.length ? frames : frames.slice(0, limit);
  const filterSet = eventFilter ? new Set(eventFilter) : null;
  const q = search.trim().toLowerCase();
  if (!filterSet && !q) return base;
  return base.filter((f) => {
    if (filterSet && !filterSet.has(f.event)) return false;
    if (
      q &&
      !f.data.toLowerCase().includes(q) &&
      !f.event.toLowerCase().includes(q) &&
      !(f.id ?? '').toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}

export function selectRevealedFrames(
  state: Pick<InspectorState, 'frames' | 'replayCursor'>,
): Frame[] {
  const limit = state.replayCursor ?? state.frames.length;
  return limit >= state.frames.length ? state.frames : state.frames.slice(0, limit);
}
