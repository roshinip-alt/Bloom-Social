/**
 * The selected local workspace id, persisted per browser. This is a UI preference (demo vs personal
 * workspace), not authentication — it holds no secret.
 */
const KEY = 'bloom.workspace';
let current: string | null = read();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export const workspaceStore = {
  get: () => current,
  set(id: string | null) {
    current = id;
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      // storage unavailable (private mode): keep the in-memory value
    }
  },
};
