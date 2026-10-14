/** A well-spread number from an integer: the same input always gives the same output, so an animation can look
 *  random yet repeat exactly where it needs to. */
export function mix(value: number): number {
  let hash = Math.imul(value + 1, 0x9e3779b1);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}
