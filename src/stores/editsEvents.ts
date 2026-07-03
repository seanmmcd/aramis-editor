export type DevelopPersistEvent =
  | { type: "edits-saved"; photoId: number }
  | { type: "checkpoints-changed"; photoId: number };

const DEVELOP_PERSIST_EVENT = "aramis:develop-persist";

export function notifyDevelopPersist(event: DevelopPersistEvent) {
  window.dispatchEvent(new CustomEvent(DEVELOP_PERSIST_EVENT, { detail: event }));
}

export function onDevelopPersist(callback: (event: DevelopPersistEvent) => void) {
  const handler = (e: Event) => {
    callback((e as CustomEvent<DevelopPersistEvent>).detail);
  };
  window.addEventListener(DEVELOP_PERSIST_EVENT, handler);
  return () => window.removeEventListener(DEVELOP_PERSIST_EVENT, handler);
}
