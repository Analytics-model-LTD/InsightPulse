// Strip client-only fields (React keys, UI flags) before sending a KPI set to a command.
const CLIENT_ONLY = new Set(['uid', 'justAdded', 'lastId']);

export function serializeSet(v) {
  if (Array.isArray(v)) return v.map(serializeSet);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !CLIENT_ONLY.has(k))
        .map(([k, x]) => [k, serializeSet(x)])
    );
  }
  return v;
}
