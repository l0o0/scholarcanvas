export interface DocumentViewState {
  anchor: number;
  head: number;
  scrollTop: number;
}
export function validViewState(value: unknown): value is DocumentViewState {
  if (!value || typeof value !== "object") return false;
  const view = value as DocumentViewState;
  return (
    Number.isSafeInteger(view.anchor) &&
    view.anchor >= 0 &&
    Number.isSafeInteger(view.head) &&
    view.head >= 0 &&
    Number.isFinite(view.scrollTop) &&
    view.scrollTop >= 0
  );
}
