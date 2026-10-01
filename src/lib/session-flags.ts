export const LOADER_SEEN_KEY = "lh:loader-seen";

function storage(s?: Storage): Storage {
  return s ?? window.sessionStorage;
}

/** True once the welcome loader has played in this browser session. */
export function hasSeenLoader(s?: Storage): boolean {
  try {
    return storage(s).getItem(LOADER_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLoaderSeen(s?: Storage): void {
  try {
    storage(s).setItem(LOADER_SEEN_KEY, "1");
  } catch {
    // Storage blocked: the loader will play again next time, which is acceptable.
  }
}
