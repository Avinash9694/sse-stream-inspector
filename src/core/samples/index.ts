import { CHAT_COMPLETIONS_STREAM } from './chat-completions';
import { DUAL_SPELLING_STREAM } from './dual-spelling';
import { generateLargeStream } from './generate';
import { ID_GAPS_STREAM } from './id-gaps';
import { MALFORMED_STREAM } from './malformed';

export interface SampleStream {
  id: string;
  name: string;
  description: string;
  text: () => string;
}

export const SAMPLE_STREAMS: readonly SampleStream[] = [
  {
    id: 'dual-spelling',
    name: 'Gateway turn — dual-spelled thinking_state',
    description:
      'One chat turn where the thinking frame arrives as both `thinking_state` and `thinking-state` with different payload shapes.',
    text: () => DUAL_SPELLING_STREAM,
  },
  {
    id: 'chat-completions',
    name: 'Chat completions — token deltas',
    description:
      'OpenAI-style chunks on the default `message` event, terminated by `data: [DONE]`.',
    text: () => CHAT_COMPLETIONS_STREAM,
  },
  {
    id: 'id-gaps',
    name: 'Ticker — duplicate and out-of-order ids, 7 s gap',
    description:
      'Numbered frames with a repeated id, a regression, a keep-alive and a long silence.',
    text: () => ID_GAPS_STREAM,
  },
  {
    id: 'malformed',
    name: 'Malformed — unknown fields, broken JSON, truncated',
    description:
      'Unknown field, non-numeric retry, data-less block, split JSON, shape drift and a missing blank line at EOF.',
    text: () => MALFORMED_STREAM,
  },
  {
    id: 'large',
    name: 'Stress test — 10,000 generated frames',
    description: 'Deterministic token stream with planted spelling drift, parsed in a worker.',
    text: () => generateLargeStream(10_000),
  },
];

export const DEFAULT_SAMPLE_ID = 'dual-spelling';

export function findSample(id: string): SampleStream | undefined {
  return SAMPLE_STREAMS.find((s) => s.id === id);
}

export { generateLargeStream };
