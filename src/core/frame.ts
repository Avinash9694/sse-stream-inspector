export interface Frame {
  /** Zero-based position in the stream. */
  index: number;
  /** Event type; `message` when the block had no `event:` field (per spec). */
  event: string;
  /** Joined `data:` lines (LF-separated). Empty when the block carried none. */
  data: string;
  /** `id:` as written in THIS block, if any. */
  id?: string;
  /** Spec `lastEventId`: the most recent id seen so far, carried across blocks. */
  lastEventId?: string;
  retry?: number;
  /** Wall-clock ms (or synthetic offset for pasted input) when the block completed. */
  receivedAt: number;
  /** UTF-8 byte offset of the block's first line within the stream. */
  byteOffset: number;
  /** The block as written, without the terminating blank line. */
  raw: string;
  comments?: string[];
  unknownFields?: string[];
  /** `retry:` values the spec ignores (non-digits). */
  invalidRetry?: string[];
  /** False when the block carried no data, which the spec would not dispatch. */
  dispatched: boolean;
  /** True when the stream ended before this block's terminating blank line. */
  incomplete?: boolean;
}

export type FrameInput = Omit<Frame, 'index'>;
