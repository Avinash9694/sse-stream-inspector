#!/usr/bin/env node
// Tiny SSE demo server with CORS, for trying "Live connect". No dependencies.
// Usage: node scripts/demo-server.mjs [port]   (default 8787)
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8787);

const STREAMS = {
  'dual-spelling': [
    [0, 'turn_start', { request_id: 'req_live', model: 'gateway-v3' }],
    [
      150,
      'thinking_state',
      { component: { type: 'thinking', props: { children: 'Reading context' } }, state: 'active' },
    ],
    [600, 'thinking-state', { message: 'Checking accounts in scope', state: 'active' }],
    [
      1200,
      'thinking_state',
      { component: { type: 'thinking', props: { children: 'Querying estate' } }, state: 'active' },
    ],
    [1800, 'thinking-state', { message: 'Drafting the answer', state: 'done' }],
    [2000, 'component_start', { component_id: 'c1', type: 'markdown' }],
    ...'Two buckets allow public reads; one is almost certainly unintended.'
      .split(' ')
      .map((w, i) => [2050 + i * 70, 'component_delta', { component_id: 'c1', delta: `${w} ` }]),
    [2900, 'component_end', { component_id: 'c1' }],
    [3000, 'done', { request_id: 'req_live', usage: { output_tokens: 11 } }],
  ],
  'chat-completions': [
    ...'Server-Sent Events is a one-way HTTP push channel.'.split(' ').map((w, i) => [
      i * 60,
      null,
      {
        id: 'chatcmpl-live',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { content: `${w} ` }, finish_reason: null }],
      },
    ]),
    [
      700,
      null,
      {
        id: 'chatcmpl-live',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      },
    ],
    [720, null, '[DONE]'],
  ],
  heartbeat: Array.from({ length: 12 }, (_, i) => [
    i * 1000,
    i % 4 === 3 ? ':' : 'tick',
    { i, at: 'now' },
  ]),
};

function writeFrame(res, at, event, payload, id) {
  const lines = [];
  lines.push(`: t=${at}`);
  if (event === ':') {
    lines.push(': keep-alive');
  } else {
    if (event) lines.push(`event: ${event}`);
    if (id !== undefined) lines.push(`id: ${id}`);
    lines.push(`data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }
  res.write(lines.join('\n') + '\n\n');
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const cors = {
    'Access-Control-Allow-Origin': req.headers.origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      req.headers['access-control-request-headers'] ?? 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '600',
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (url.pathname === '/' || url.pathname === '/streams') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        streams: Object.keys(STREAMS).map((k) => `/stream/${k}`),
        speed: '?speed=2 to run faster',
      }),
    );
    return;
  }
  const match = /^\/stream\/([\w-]+)$/.exec(url.pathname);
  const frames = match && STREAMS[match[1]];
  if (!frames) {
    res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unknown stream', available: Object.keys(STREAMS) }));
    return;
  }
  const speed = Math.max(0.1, Number(url.searchParams.get('speed') ?? 1));
  res.writeHead(200, {
    ...cors,
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  const timers = [];
  frames.forEach(([at, event, payload], i) => {
    timers.push(
      setTimeout(
        () => writeFrame(res, at, event, payload, match[1] === 'heartbeat' ? i : undefined),
        at / speed,
      ),
    );
  });
  const last = frames[frames.length - 1]?.[0] ?? 0;
  timers.push(setTimeout(() => res.end(), last / speed + 50));
  req.on('close', () => timers.forEach(clearTimeout));
});

server.listen(PORT, () => {
  console.log(`SSE demo server on http://localhost:${PORT}`);
  for (const k of Object.keys(STREAMS)) console.log(`  http://localhost:${PORT}/stream/${k}`);
});
