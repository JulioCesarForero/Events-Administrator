const KEY = 'staff_event_names';

/** Guarda id → nombre de los eventos listados para mostrarlos en la navegación. */
export function rememberEventNames(events: Array<{ id: string; name: string }>) {
  try {
    const map = Object.fromEntries(events.map((e) => [e.id, e.name]));
    sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // sessionStorage no disponible: la navegación muestra "Evento actual".
  }
}

export function getRememberedEventName(eventId: string): string | undefined {
  try {
    const map = JSON.parse(sessionStorage.getItem(KEY) || '{}') as Record<string, string>;
    return map[eventId];
  } catch {
    return undefined;
  }
}
