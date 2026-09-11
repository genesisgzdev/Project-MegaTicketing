import React, { useEffect, useMemo, useState } from 'react';

type SeatStatus = 'available' | 'selected' | 'held' | 'sold';
type Seat = { id: string; seatNumber: string; price: number; currency: string; status: Exclude<SeatStatus, 'selected'> };
type Event = { id: string; title: string };
const classes: Record<SeatStatus, string> = {
  available: 'bg-slate-700 border-slate-600 hover:bg-indigo-500/70',
  selected: 'bg-emerald-400 border-emerald-200 scale-110',
  held: 'bg-amber-500/60 border-amber-300/80 cursor-not-allowed',
  sold: 'bg-rose-900/70 border-rose-700/80 cursor-not-allowed opacity-50',
};
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);

export default function CyberArena() {
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<string>(import.meta.env.VITE_EVENT_ID || '');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('Loading events…');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadEvents = async () => {
      const collected: Event[] = [];
      let cursor: string | null = null;
      do {
        const response = await fetch(`${apiBase}/events${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Events are unavailable.');
        const payload = await response.json();
        if (!Array.isArray(payload.events)) throw new Error('Invalid event response.');
        collected.push(...payload.events);
        if (payload.nextCursor === cursor && cursor) throw new Error('Event pagination did not advance.');
        cursor = payload.nextCursor || null;
      } while (cursor && !controller.signal.aborted);
      if (controller.signal.aborted) return;
      setEvents(collected);
      setEventId(current => current || collected[0]?.id || '');
      if (!collected.length) setMessage('No upcoming events are available.');
    };
    void loadEvents().catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [apiBase]);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setSeats([]); setSelected([]); setReady(false); setMessage('Loading inventory…');
    const refresh = async () => {
      try {
        const response = await fetch(`${apiBase}/events/${encodeURIComponent(eventId)}/seats`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Inventory unavailable (${response.status}).`);
        const payload = await response.json();
        if (!Array.isArray(payload.seats)) throw new Error('Invalid inventory response.');
        const next = payload.seats as Seat[];
        if (active) {
          setSeats(next);
          setSelected(current => current.filter(id => next.some(seat => seat.id === id && seat.status === 'available')));
          setReady(true);
          setMessage(next.length ? '' : 'This event has no seats.');
        }
      } catch (error) {
        if (active) { setReady(false); setSelected([]); setMessage(error instanceof Error ? error.message : 'Inventory unavailable.'); }
      } finally { if (active) timer = setTimeout(refresh, 5000); }
    };
    void refresh();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [apiBase, eventId]);

  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const seat of seats) if (selected.includes(seat.id)) sums[seat.currency] = (sums[seat.currency] || 0) + seat.price;
    return sums;
  }, [seats, selected]);

  return <div className="w-full rounded-3xl border border-white/10 bg-slate-900/50 p-6 lg:p-8">
    <label className="block mb-6 text-sm text-slate-300">Event
      <select aria-label="Event" className="mt-2 block w-full rounded-lg bg-slate-800 p-3" value={eventId} onChange={event => setEventId(event.target.value)}>
        {!events.length && <option value={eventId}>No event list available</option>}
        {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
      </select>
    </label>
    <div className="mb-6 border-t-4 border-indigo-300/80 py-3 text-center text-xs uppercase tracking-widest text-indigo-100">Live venue inventory</div>
    {message && <p role="status" className="p-6 text-center text-slate-400">{message}</p>}
    {ready && <div className="grid gap-2 p-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2.5rem, 1fr))' }} aria-label="Live seat map">
      {seats.map(seat => {
        const status = selected.includes(seat.id) ? 'selected' : seat.status;
        return <button key={seat.id} type="button" className={`h-10 rounded border text-xs focus:ring-2 focus:ring-indigo-200 ${classes[status]}`}
          aria-label={`${seat.seatNumber}, ${status}, ${money(seat.price, seat.currency)}`} aria-pressed={status === 'selected'}
          disabled={seat.status !== 'available'} onClick={() => setSelected(current => current.includes(seat.id) ? current.filter(id => id !== seat.id) : [...current, seat.id])}>
          {seat.seatNumber}
        </button>;
      })}
    </div>}
    <div className="mt-6 flex flex-wrap justify-between gap-4 text-xs text-slate-400">
      <span>{selected.length} selected · availability refreshes every 5s</span>
      <span>{Object.entries(totals).map(([currency, total]) => money(total, currency)).join(' + ')}</span>
    </div>
    <p className="mt-3 text-xs text-slate-500">Selection previews the price. Seats are held only after an authenticated reservation succeeds.</p>
  </div>;
}
