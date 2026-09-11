import { useEffect, useMemo, useRef, useState } from 'react';

type SeatStatus = 'available' | 'held' | 'sold';
type Seat = { id: string; seatNumber: string; price: number; currency: string; status: SeatStatus };
type Event = { id: string; title: string; date?: string; description?: string };
type Session = { token: string; userId: string };
type Reservation = { seatId: string; label: string; state: 'accepted' | 'failed'; message: string };
const labels = { available: 'Disponible', selected: 'Elegido', held: 'En reserva', sold: 'Vendido' };
const money = (value: number, currency: string) => new Intl.NumberFormat('es', { style: 'currency', currency }).format(value);
const requestMessage = (status: number) => ({401: 'Tu acceso venció o no es válido. Vuelve a conectarlo.',403: 'El organizador no ha autorizado esta reserva. Ponte en contacto con su equipo.',409: 'Ese asiento ya no está disponible. Elige otro.',429: 'Hay muchas solicitudes. Espera un momento antes de volver a intentar.'} as Record<number, string>)[status] || 'No pudimos confirmar la reserva. Puedes volver a intentarlo.';

export default function CyberArena() {
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState(import.meta.env.VITE_EVENT_ID || '');
  const [event, setEvent] = useState<Event | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('Buscando próximos eventos…');
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [credential, setCredential] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [accessMessage, setAccessMessage] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [updated, setUpdated] = useState<Date | null>(null);
  const busy = useRef(false);
  const keys = useRef(new Map<string, string>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadEvents = async () => {
      const collected: Event[] = [];
      const seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const response = await fetch(`${apiBase}/events${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal });
        if (!response.ok) throw new Error('No pudimos consultar los eventos. Vuelve a intentarlo.');
        const payload = await response.json();
        if (!Array.isArray(payload.events)) throw new Error('La lista de eventos no se pudo leer.');
        collected.push(...payload.events);
        cursor = payload.nextCursor || null;
        if (cursor && seen.has(cursor)) throw new Error('No pudimos completar la lista de eventos. Vuelve a intentarlo.');
        if (cursor) seen.add(cursor);
      } while (cursor && !controller.signal.aborted);
      if (controller.signal.aborted) return;
      setEvents(collected);
      setEventId(current => collected.some(item => item.id === current) ? current : collected[0]?.id || '');
      if (!collected.length) { setMessage('Todavía no hay próximos eventos publicados. Vuelve cuando el organizador publique uno.'); setSeats([]); setReady(false); setSelected([]); setEvent(null); }
    };
    void loadEvents().catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [apiBase, reload]);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setSeats([]); setSelected([]); setReady(false); setEvent(null); setUpdated(null); setReservations([]); setMessage('Consultando los asientos…');
    const refresh = async () => {
      try {
        const response = await fetch(`${apiBase}/events/${encodeURIComponent(eventId)}/seats`, { signal: controller.signal });
        if (!response.ok) throw new Error('No pudimos actualizar los asientos. Tu selección necesita una nueva comprobación.');
        const payload = await response.json();
        if (!Array.isArray(payload.seats)) throw new Error('No pudimos leer la disponibilidad.');
        const next = payload.seats as Seat[];
        if (active) {
          setSeats(next); setEvent(payload.event || null);
          setSelected(current => current.filter(id => next.some(seat => seat.id === id && seat.status === 'available')));
          setReady(true); setUpdated(new Date());
          setMessage(next.length ? '' : 'El organizador aún no publicó asientos para este evento.');
        }
      } catch (error) {
        if (active) { setReady(false); setSelected([]); setMessage(error instanceof Error ? error.message : 'No pudimos consultar los asientos.'); }
      } finally { if (active) timer = setTimeout(refresh, 5000); }
    };
    void refresh();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [apiBase, eventId, reload]);

  const chosen = useMemo(() => seats.filter(seat => selected.includes(seat.id)), [seats, selected]);
  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const seat of chosen) sums[seat.currency] = (sums[seat.currency] || 0) + seat.price;
    return sums;
  }, [chosen]);
  const visible = seats.filter(seat => (!onlyAvailable || seat.status === 'available') && seat.seatNumber.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const currentEvent = event || events.find(item => item.id === eventId);

  async function connectAccess(event: React.FormEvent) {
    event.preventDefault();
    if (connecting || !credential.trim()) return;
    setConnecting(true); setAccessMessage('Comprobando tu acceso…');
    try {
      const response = await fetch(`${apiBase}/session`, { headers: { Authorization: `Bearer ${credential.trim()}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Ese acceso no se pudo validar. Pide uno vigente al organizador.');
      const data = await response.json();
      if (typeof data.userId !== 'string') throw new Error('No pudimos identificar tu acceso.');
      if (!mounted.current) return;
      setSession({ token: credential.trim(), userId: data.userId }); setCredential(''); setAccessMessage('Acceso conectado. Ya puedes reservar.');
    } catch (error) { if (mounted.current) setAccessMessage(error instanceof Error ? error.message : 'No pudimos conectar. Inténtalo de nuevo.'); }
    finally { if (mounted.current) setConnecting(false); }
  }

  async function reserve() {
    if (!session || !ready || busy.current || !chosen.length) return;
    busy.current = true; setReserving(true); setReservations([]);
    const selection = [...chosen];
    try {
      for (const seat of selection) {
        const scope = `${session.userId}:${eventId}:${seat.id}`;
        const key = keys.current.get(scope) || crypto.randomUUID();
        keys.current.set(scope, key);
        let result: Reservation;
        try {
          const response = await fetch(`${apiBase}/reserve`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'Idempotency-Key': key }, body: JSON.stringify({ eventId, seatId: seat.id, userId: session.userId }) });
          const data = await response.json();
          if (!response.ok || data.data?.reserved !== true || data.data?.seatId !== seat.id) {
            if (response.status < 500) keys.current.delete(scope);
            if (response.status === 401) setSession(null);
            throw new Error(requestMessage(response.status));
          }
          keys.current.delete(scope);
          result = { seatId: seat.id, label: seat.seatNumber, state: 'accepted', message: 'Reserva temporal aceptada. Todavía no es una entrada pagada.' };
          if (mounted.current) { setSelected(current => current.filter(id => id !== seat.id)); setSeats(current => current.map(item => item.id === seat.id ? { ...item, status: 'held' } : item)); }
        } catch (error) { result = { seatId: seat.id, label: seat.seatNumber, state: 'failed', message: error instanceof Error ? error.message : 'No pudimos confirmar la reserva. Vuelve a intentarlo.' }; }
        if (!mounted.current) break;
        setReservations(current => [...current, result]);
      }
    } finally { busy.current = false; if (mounted.current) setReserving(false); }
  }

  return <div className="booking-layout">
    <section className="inventory-card" aria-labelledby="event-heading"><div className="section-title"><span className="step-number">1</span><div><p className="eyebrow">El plan</p><h2 id="event-heading">Elige dónde quieres estar</h2></div></div>
      <label className="field-label" htmlFor="event">Próximo evento</label><select id="event" value={eventId} disabled={reserving} onChange={event => setEventId(event.target.value)}>{!events.length && <option value="">Sin eventos publicados</option>}{events.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      {currentEvent && <div className="event-detail"><h3>{currentEvent.title}</h3>{currentEvent.date && <p>{new Date(currentEvent.date).toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })}</p>}{currentEvent.description && <p>{currentEvent.description}</p>}</div>}
      <div className="inventory-heading"><h3>Tus asientos</h3><span className="live-label">{ready ? 'Disponibilidad actualizada' : 'Esperando disponibilidad'}</span></div>
      {message && <div className="empty-state" role="status"><p>{message}</p><button className="secondary-button" disabled={reserving} onClick={() => setReload(value => value + 1)}>Volver a consultar</button></div>}
      {ready && seats.length > 0 && <><div className="seat-toolbar"><label>Buscar asiento<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Por ejemplo, A12" /></label><label className="check-label"><input type="checkbox" checked={onlyAvailable} onChange={event => setOnlyAvailable(event.target.checked)} />Solo disponibles</label></div><ul className="seat-legend" aria-label="Estados de los asientos">{Object.entries(labels).map(([key, label]) => <li key={key}><span className={`legend-dot ${key}`} />{label}</li>)}</ul><div className="seat-map" aria-label="Asientos del evento">{visible.map(seat => {
        const status = selected.includes(seat.id) ? 'selected' : seat.status;
        return <button key={seat.id} type="button" className={`seat ${status}`} aria-label={`${seat.seatNumber}, ${labels[status]}, ${money(seat.price, seat.currency)}`} aria-pressed={status === 'selected'} disabled={reserving || seat.status !== 'available'} onClick={() => setSelected(current => current.includes(seat.id) ? current.filter(id => id !== seat.id) : [...current, seat.id])}>{seat.seatNumber}</button>;
      })}</div>{!visible.length && <p className="muted">No hay asientos que coincidan con tu búsqueda.</p>}<p className="muted small">Lista de asientos, sin distribución física del recinto. Se actualiza cada 5 segundos{updated ? ` · ${updated.toLocaleTimeString('es')}` : ''}.</p></>}
    </section>
    <aside className="selection-card" aria-labelledby="selection-heading"><div className="section-title"><span className="step-number">2</span><div><p className="eyebrow">Tu selección</p><h2 id="selection-heading">Todo a la vista</h2></div></div><p role="status">{chosen.length} {chosen.length === 1 ? 'asiento elegido' : 'asientos elegidos'}</p>
      {!chosen.length && <p className="muted">Toca un asiento disponible para ver aquí su precio.</p>}
      <ul className="chosen-list">{chosen.map(seat => <li key={seat.id}><span>Asiento {seat.seatNumber}</span><strong>{money(seat.price, seat.currency)}</strong><button className="remove-button" disabled={reserving} aria-label={`Quitar asiento ${seat.seatNumber}`} onClick={() => setSelected(current => current.filter(id => id !== seat.id))}>×</button></li>)}</ul>
      {chosen.length > 0 && <><div className="total-row"><span>Total de asientos</span><strong>{Object.entries(totals).map(([currency, total]) => money(total, currency)).join(' + ')}</strong></div><p className="muted small">Elegir un asiento no lo aparta. El organizador confirma cada reserva.</p>
      {!session ? <form onSubmit={connectAccess} className="access-form"><label className="field-label" htmlFor="access">Acceso facilitado por el organizador</label><input id="access" type="password" value={credential} onChange={event => setCredential(event.target.value)} autoComplete="off" spellCheck={false} required /><p className="muted small">Si aún no lo tienes, solicítalo al organizador. Se conserva solo mientras esta página siga abierta.</p><button className="secondary-button" disabled={connecting || !credential.trim()}>{connecting ? 'Comprobando…' : 'Conectar acceso'}</button></form> : <><p className="connected-label">Acceso conectado</p><button className="primary-button" disabled={reserving || !ready} onClick={() => void reserve()}>{reserving ? 'Consultando al organizador…' : 'Reservar selección'}</button><button className="text-button" disabled={reserving} onClick={() => { setSession(null); setAccessMessage(''); keys.current.clear(); }}>Desconectar acceso</button></>}
      <p role="status" className="small">{accessMessage}</p></>}
      <div aria-live="polite" className="reservation-results">{reservations.map(result => <div key={result.seatId} className={`reservation-result ${result.state}`}><strong>Asiento {result.label}</strong><p>{result.message}</p></div>)}</div>
      <details className="booking-help"><summary>¿Qué ocurre después de reservar?</summary><p>La reserva es temporal. El pago debe completarse en el flujo habilitado por el organizador antes de que venza. Esta pantalla no cobra ni emite entradas.</p><p>Si eliges varios asientos, se reservan uno por uno. Revisa el resultado de cada uno.</p></details>
    </aside>
  </div>;
}
