/**
 * Waveform shape for the "waveform" signature. Deterministic (no randomness) so it is testable
 * and identical on every visit. It is a voice-like envelope that starts and ends on the centre
 * line, so it reads as a signal coming out of, and settling back into, a straight pipeline.
 */
export function waveformPoints(width: number, height: number, samples = 56): Array<[number, number]> {
  const mid = height / 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const envelope = Math.sin(Math.PI * t) ** 1.4;            // 0 at both ends
    const speech = 0.55 + 0.45 * Math.sin(2 * Math.PI * 2.5 * t + 0.6); // syllable-like swell
    const carrier = Math.sin(2 * Math.PI * 9 * t);
    pts.push([t * width, mid - mid * 0.92 * envelope * speech * carrier]);
  }
  return pts;
}

export function waveformPath(width: number, height: number, samples = 56): string {
  return waveformPoints(width, height, samples)
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join('');
}
