/**
 * The CAD exploded view (ADR-0016 amendment 2): pure geometry for the MalTrace teardown. The PE sections lift out of the file
 * shell like components in an exploded drawing. Every transform is derived from the slab's index and the explode amount, never
 * from a section's name. Annotations live in a flat 2D overlay, so their anchors are the slabs' 3D points projected through the
 * same perspective the browser uses. Nothing here touches the DOM or the clock.
 */

export interface Slab3 { x: number; z: number; rx: number; ry: number }
/** How far the stack opens: px sideways, px in depth, degrees of tilt (never more than 12). */
export interface Spread { x: number; z: number; rot: number }
export const SPREAD = { desktop: { x: 64, z: 150, rot: 10 }, mobile: { x: 14, z: 48, rot: 5 } } as const satisfies Record<string, Spread>;
export const MAX_ROT = 12;
/** Perspective distance, px. The same number is in the stylesheet (`.td-world`). */
export const PERSP = 1200;

/** Even slabs go left and forward, odd slabs right and back; deeper ones in the stack open a little further. t is 0..1. */
export function slabTransform(i: number, n: number, t: number, s: Spread): Slab3 {
  const side = i % 2 === 0 ? -1 : 1;
  const k = 0.6 + 0.4 * (n > 1 ? i / (n - 1) : 0);
  const rot = Math.min(MAX_ROT, s.rot);
  return { x: side * s.x * k * t, z: -side * s.z * k * t, rx: -side * 0.6 * rot * t, ry: side * rot * t };
}

export type P3 = { x: number; y: number; z: number };
/** Perspective projection about `o` (z toward the viewer is positive). Returns the screen point and the scale at that depth. */
export function project(p: P3, o: { x: number; y: number }, d = PERSP): { x: number; y: number; s: number } {
  const s = d / (d - p.z);
  return { x: o.x + (p.x - o.x) * s, y: o.y + (p.y - o.y) * s, s };
}

const rad = Math.PI / 180;
/**
 * A point on a slab, projected. `c` is the slab's centre before transforms, `local` an offset from it, `tf` its transform
 * (CSS order translate3d, rotateX, rotateY about the centre), `dy` any extra vertical offset.
 */
export function slabPoint(local: { x: number; y: number }, c: { x: number; y: number }, tf: Slab3, o: { x: number; y: number }, dy = 0, d = PERSP) {
  const [cb, sb, ca, sa] = [Math.cos(tf.ry * rad), Math.sin(tf.ry * rad), Math.cos(tf.rx * rad), Math.sin(tf.rx * rad)];
  const x1 = local.x * cb, z1 = -local.x * sb;                       // rotateY
  const y2 = local.y * ca - z1 * sa, z2 = local.y * sa + z1 * ca;    // then rotateX
  return project({ x: c.x + tf.x + x1, y: c.y + dy + y2, z: tf.z + z2 }, o, d);
}

export interface Band { y: number; h: number }
/**
 * Where each section sits inside the file shell in X-RAY. With real raw offsets for every section (and the file size) a band
 * is placed at offset/size and is size/fileSize tall. Without them the bands are equal and `proportional` is false: positions
 * are never derived from cumulative section sizes, which would pretend to be offsets.
 */
export function bands(secs: { size: number; offset?: number }[], fileSize: number, shellH: number): { bands: Band[]; proportional: boolean } {
  const real = secs.length > 0 && fileSize > 0 && secs.every((s) => s.offset !== undefined && Number.isFinite(s.offset));
  if (!real) return { bands: secs.map((_, i) => ({ y: (i * shellH) / secs.length, h: shellH / secs.length })), proportional: false };
  return { bands: secs.map((s) => ({ y: (s.offset! / fileSize) * shellH, h: Math.max(2, (s.size / fileSize) * shellH) })), proportional: true };
}

/**
 * Where slab i's annotation sits. Desktop: even slabs on the left margin, odd on the right, level with the anchor. Mobile:
 * alternating sides and directly below the slab, so the text never needs the room the slab uses. Always inside [pad, W - pad].
 * `lx`, `ly` is where the leader line leaves the label: its inner edge level with the text (desktop), or its top edge (mobile).
 */
export function labelSpot(i: number, anchor: { x: number; y: number }, below: number, W: number, pad: number, mobile: boolean, boxW: number, boxH: number) {
  const right = i % 2 === 1;
  const x = right ? W - pad - boxW : pad;
  const y = mobile ? below + 4 : anchor.y - boxH / 2;
  const cx = Math.max(pad, Math.min(W - pad - boxW, x));
  return { x: cx, y, right, lx: mobile ? cx + (right ? boxW : 0) : right ? cx : cx + boxW, ly: mobile ? y : y + boxH / 2 };
}
