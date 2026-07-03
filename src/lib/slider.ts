/** True when a pointer event is on the range input thumb (not the track). */
export function isRangeThumbHit(input: HTMLInputElement, clientX: number): boolean {
  const rect = input.getBoundingClientRect();
  if (rect.width <= 0) return false;

  const min = Number(input.min);
  const max = Number(input.max);
  const span = max - min;
  if (span === 0) return false;

  const ratio = (Number(input.value) - min) / span;
  const thumbCenter = rect.left + ratio * rect.width;
  const thumbRadius = 12;
  return Math.abs(clientX - thumbCenter) <= thumbRadius;
}
