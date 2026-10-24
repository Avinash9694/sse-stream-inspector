import type { Frame } from './frame';

export interface SseParserOptions {
  /** Timestamp source; defaults to `Date.now`. */
  now?: () => number;
  /** Starting index for emitted frames. */
  startIndex?: number;
}

interface Block {
  event: string | undefined;
  data: string[];
  id: string | undefined;
  retry: number | undefined;
  comments: string[];
  unknownFields: string[];
  invalidRetry: string[];
  rawLines: string[];
  byteOffset: number;
}

const BOM = '﻿';

/**
 * Streaming `text/event-stream` parser. Feed chunks (strings or bytes) with
 * `push`; blocks are dispatched on blank lines exactly as the WHATWG spec
 * describes, but non-dispatchable blocks (no data, comment-only) are still
 * emitted with `dispatched: false` so a debugger can show heartbeats.
 */
export class SseParser {
  private buffer = '';
  private readonly decoder = new TextDecoder('utf-8');
  private readonly now: () => number;
  private index: number;
  private lastEventId: string | undefined;
  private consumedBytes = 0;
  private startedStream = false;
  private block: Block = freshBlock(0);

  constructor(options: SseParserOptions = {}) {
    this.now = options.now ?? Date.now;
    this.index = options.startIndex ?? 0;
  }

  /** Current frame index that the next dispatched block will receive. */
  get nextIndex(): number {
    return this.index;
  }

  push(chunk: string | Uint8Array): Frame[] {
    const text = typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
    this.buffer += text;
    if (!this.startedStream && this.buffer.length > 0) {
      this.startedStream = true;
      if (this.buffer.startsWith(BOM)) {
        this.buffer = this.buffer.slice(1);
        this.consumedBytes += 3;
        this.block.byteOffset = this.consumedBytes;
      }
    }
    return this.drain(false);
  }

  /** Flush the decoder and any trailing partial block. */
  end(): Frame[] {
    const tail = this.decoder.decode();
    if (tail) this.buffer += tail;
    const frames = this.drain(true);
    if (this.block.rawLines.length > 0) {
      const frame = this.dispatch(true);
      if (frame) frames.push(frame);
    }
    return frames;
  }

  private drain(flush: boolean): Frame[] {
    const frames: Frame[] = [];
    let start = 0;
    const buf = this.buffer;
    const len = buf.length;
    while (start < len) {
      let end = -1;
      let eolLen = 0;
      for (let i = start; i < len; i++) {
        const c = buf.charCodeAt(i);
        if (c === 10) {
          end = i;
          eolLen = 1;
          break;
        }
        if (c === 13) {
          if (i + 1 < len) {
            end = i;
            eolLen = buf.charCodeAt(i + 1) === 10 ? 2 : 1;
            break;
          }
          // A CR at the very end may be half of a CRLF; wait unless flushing.
          if (flush) {
            end = i;
            eolLen = 1;
          }
          break;
        }
      }
      if (end === -1) break;
      const line = buf.slice(start, end);
      const frame = this.handleLine(line, utf8Length(line) + eolLen);
      if (frame) frames.push(frame);
      start = end + eolLen;
    }
    if (flush && start < len) {
      const line = buf.slice(start);
      const frame = this.handleLine(line, utf8Length(line));
      if (frame) frames.push(frame);
      start = len;
    }
    this.buffer = buf.slice(start);
    return frames;
  }

  private handleLine(line: string, byteLen: number): Frame | undefined {
    let result: Frame | undefined;
    if (line === '') {
      result = this.dispatch(false);
      this.consumedBytes += byteLen;
      this.block = freshBlock(this.consumedBytes);
      return result;
    }
    const block = this.block;
    block.rawLines.push(line);
    if (line.charCodeAt(0) === 58) {
      block.comments.push(line.slice(1).startsWith(' ') ? line.slice(2) : line.slice(1));
      this.consumedBytes += byteLen;
      return undefined;
    }
    const colon = line.indexOf(':');
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }
    switch (field) {
      case 'event':
        block.event = value;
        break;
      case 'data':
        block.data.push(value);
        break;
      case 'id':
        if (!value.includes('\u0000')) {
          block.id = value;
          this.lastEventId = value;
        }
        break;
      case 'retry':
        if (/^\d+$/.test(value)) block.retry = Number(value);
        else block.invalidRetry.push(value);
        break;
      default:
        block.unknownFields.push(field);
    }
    this.consumedBytes += byteLen;
    return undefined;
  }

  private dispatch(incomplete: boolean): Frame | undefined {
    const block = this.block;
    if (block.rawLines.length === 0) return undefined;
    const hasData = block.data.length > 0;
    const frame: Frame = {
      index: this.index++,
      event: block.event ?? (hasData ? 'message' : ''),
      data: block.data.join('\n'),
      receivedAt: this.now(),
      byteOffset: block.byteOffset,
      raw: block.rawLines.join('\n'),
      dispatched: hasData,
    };
    if (block.id !== undefined) frame.id = block.id;
    if (this.lastEventId !== undefined) frame.lastEventId = this.lastEventId;
    if (block.retry !== undefined) frame.retry = block.retry;
    if (block.comments.length) frame.comments = block.comments;
    if (block.unknownFields.length) frame.unknownFields = block.unknownFields;
    if (block.invalidRetry.length) frame.invalidRetry = block.invalidRetry;
    if (incomplete) frame.incomplete = true;
    if (incomplete) this.block = freshBlock(this.consumedBytes);
    return frame;
  }
}

function freshBlock(byteOffset: number): Block {
  return {
    event: undefined,
    data: [],
    id: undefined,
    retry: undefined,
    comments: [],
    unknownFields: [],
    invalidRetry: [],
    rawLines: [],
    byteOffset,
  };
}

export function utf8Length(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** Parse a complete stream in one go. */
export function parseSseText(text: string, options: SseParserOptions = {}): Frame[] {
  const parser = new SseParser(options);
  return [...parser.push(text), ...parser.end()];
}
