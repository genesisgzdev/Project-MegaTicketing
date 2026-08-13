import React, { useEffect, useMemo, useState } from 'react';

type SeatStatus = 'available' | 'selected' | 'held' | 'sold';
type Seat = { id: string; seatNumber: string; price: number; status: Exclude<SeatStatus, 'selected'> };

const classes: Record<SeatStatus, string> = {
  available: 'bg-slate-700 border-slate-600 hover:bg-indigo-500/70 hover:border-indigo-300',
  selected: 'bg-emerald-400 border-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.75)] scale-110',
  held: 'bg-amber-500/60 border-amber-300/80 cursor-not-allowed',
  sold: 'bg-rose-900/70 border-rose-700/80 cursor-not-allowed opacity-50',
};

export default function CyberArena() {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const eventId = import.meta.env.VITE_EVENT_ID;
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [message, setMessage] = useState('Loading live inventory…');

  useEffect(() => {
    if (!eventId) {
      setState('empty');
      setMessage('Set VITE_EVENT_ID to load a real event inventory.');
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`${apiBase}/events/${eventId}/seats`);
        if (!response.ok) throw new Error(`Inventory request failed (${response.status})`);
        const payload = await response.json();
        if (active) { setSeats(payload.seats); setState('ready'); }
      } catch (error) {
        if (active) { setState('error'); setMessage(error instanceof Error ? error.message : 'Inventory unavailable'); }
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [apiBase, eventId]);

  const total = useMemo(() => seats.filter((seat) => selected.includes(seat.id)).reduce((sum, seat) => sum + seat.price, 0), [seats, selected]);
  const toggleSeat = (seat: Seat) => {
    if (seat.status !== 'available') return;
    setSelected((current) => current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id]);
  };

  return <div className="relative w-full bg-slate-900/50 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden p-6 lg:p-8">
    <div className="mb-6 rounded-t-full border-t-4 border-indigo-300/80 bg-indigo-500/10 py-3 text-center text-[10px] font-black uppercase tracking-[0.5em] text-indigo-100">Live venue inventory</div>
    {state === 'ready' && <div className="grid grid-cols-20 gap-1.5 max-w-full overflow-auto custom-scrollbar p-2" role="grid" aria-label="Live seat map">
      {seats.map((seat) => { const status = selected.includes(seat.id) ? 'selected' : seat.status; return <button key={seat.id} type="button" className={`h-5 w-5 rounded-sm border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${classes[status]}`} role="gridcell" aria-label={`${seat.seatNumber}, ${status}, $${seat.price}`} aria-pressed={selected.includes(seat.id)} disabled={seat.status !== 'available'} title={`${seat.seatNumber} · $${seat.price} · ${status}`} onClick={() => toggleSeat(seat)} />; })}
    </div>}
    {state !== 'ready' && <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-slate-400">{message}</div>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400"><div>{selected.length} selected · inventory refreshes every 5s</div><div className="font-mono text-lg font-black text-emerald-300">${total.toFixed(2)}</div></div>
  </div>;
}
