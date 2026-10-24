/** Deterministic pseudo-random token stream with a planted spelling drift, for stress-testing. */
export function generateLargeStream(frameCount = 10_000, seed = 7): string {
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const words = [
    'the',
    'stream',
    'arrives',
    'in',
    'order',
    'mostly',
    'with',
    'tiny',
    'deltas',
    'and',
    'one',
    'drift',
  ];
  const parts: string[] = [];
  let t = 0;
  parts.push(`: t=0\nevent: turn_start\ndata: {"request_id":"req_big","frames":${frameCount}}\n`);
  for (let i = 1; i < frameCount - 1; i++) {
    t += 8 + Math.floor(rand() * 30);
    const r = rand();
    if (r < 0.02) {
      const spelled = rand() < 0.5 ? 'thinking_state' : 'thinking-state';
      const payload =
        spelled === 'thinking_state'
          ? `{"component":{"type":"thinking","props":{"children":"step ${i}"}}}`
          : `{"message":"step ${i}","state":"active"}`;
      parts.push(`: t=${t}\nevent: ${spelled}\ndata: ${payload}\n`);
    } else if (r < 0.03) {
      parts.push(`: t=${t}\n: keep-alive\n`);
    } else {
      const w = words[Math.floor(rand() * words.length)] ?? words[0];
      parts.push(
        `: t=${t}\nevent: component_delta\nid: ${i}\ndata: {"component_id":"c1","delta":"${w} "}\n`,
      );
    }
  }
  t += 20;
  parts.push(
    `: t=${t}\nevent: done\ndata: {"request_id":"req_big","usage":{"output_tokens":${frameCount}}}\n`,
  );
  return parts.join('\n') + '\n';
}
