import React, { useMemo, useState } from 'react';

const ROWS = 20;
const COLUMNS = 20;
const PREMIUM_ROWS = new Set([0, 1, 2, 3]);
const ACCESSIBLE_SEATS = new Set(['R02-S03', 'R02-S18', 'R10-S01', 'R10-S20', 'R18-S04', 'R18-S17']);
const HELD_SEATS = new Set(['R01-S04', 'R01-S05', 'R03-S11', 'R04-S12', 'R07-S08', 'R08-S08', 'R14-S15']);
const SOLD_SEATS = new Set(['R02-S09', 'R02-S10', 'R02-S11', 'R05-S06', 'R05-S07', 'R11-S13', 'R12-S13', 'R17-S02']);

type SeatStatus = 'available' | 'selected' | 'held' | 'sold' | 'accessible' | 'premium';

type Seat = {
  id: string;
  row: number;
  column: number;
  section: 'left' | 'center' | 'right';
  status: Exclude<SeatStatus, 'selected'>;
  price: number;
};

const formatSeatId = (row: number, column: number) => `R${String(row + 1).padStart(2, '0')}-S${String(column + 1).padStart(2, '0')}`;

const getSeatStatus = (id: string, row: number): Seat['status'] => {
  if (SOLD_SEATS.has(id)) return 'sold';
  if (HELD_SEATS.has(id)) return 'held';
  if (ACCESSIBLE_SEATS.has(id)) return 'accessible';
  if (PREMIUM_ROWS.has(row)) return 'premium';
  return 'available';
};

const getSeatClass = (status: SeatStatus) => {
  const classes: Record<SeatStatus, string> = {
    available: 'bg-slate-700 border-slate-600 hover:bg-indigo-500/70 hover:border-indigo-300',
    selected: 'bg-emerald-400 border-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.75)] scale-110',
    held: 'bg-amber-500/60 border-amber-300/80 cursor-not-allowed',
    sold: 'bg-rose-900/70 border-rose-700/80 cursor-not-allowed opacity-50',
    accessible: 'bg-sky-500/80 border-sky-200 hover:bg-sky-300',
    premium: 'bg-violet-500/80 border-violet-200 hover:bg-violet-300',
  };

  return classes[status];
};

/**
 * CyberArena renders a deterministic, data-backed 20x20 venue map with live seat selection.
 * Seats are mapped by row/column instead of static placeholders so UX, pricing, and state stay in sync.
 */
const CyberArena = React.memo(() => {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  const seats = useMemo<Seat[]>(() => Array.from({ length: ROWS * COLUMNS }, (_, index) => {
    const row = Math.floor(index / COLUMNS);
    const column = index % COLUMNS;
    const id = formatSeatId(row, column);
    const section = column < 6 ? 'left' : column > 13 ? 'right' : 'center';
    const rowPrice = PREMIUM_ROWS.has(row) ? 180 : row < 10 ? 125 : 85;
    const sectionPrice = section === 'center' ? 25 : 0;

    return {
      id,
      row: row + 1,
      column: column + 1,
      section,
      status: getSeatStatus(id, row),
      price: rowPrice + sectionPrice,
    };
  }), []);

  const selectedSeats = useMemo(
    () => seats.filter((seat) => selectedSeatIds.includes(seat.id)),
    [seats, selectedSeatIds],
  );

  const total = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

  const toggleSeat = (seat: Seat) => {
    if (seat.status === 'sold' || seat.status === 'held') return;

    setSelectedSeatIds((current) => (
      current.includes(seat.id)
        ? current.filter((id) => id !== seat.id)
        : [...current, seat.id]
    ));
  };

  return (
    <div className="relative w-full bg-slate-900/50 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden p-6 lg:p-8">
      <div className="mb-6 rounded-t-full border-t-4 border-indigo-300/80 bg-indigo-500/10 py-3 text-center text-[10px] font-black uppercase tracking-[0.5em] text-indigo-100 shadow-[0_-18px_55px_rgba(99,102,241,0.28)]">
        Main Stage
      </div>

      <div className="grid grid-cols-20 gap-1.5 max-w-full overflow-auto custom-scrollbar p-2" role="grid" aria-label="Interactive Seat Map">
        {seats.map((seat) => {
          const isSelected = selectedSeatIds.includes(seat.id);
          const status: SeatStatus = isSelected ? 'selected' : seat.status;

          return (
            <button
              key={seat.id}
              type="button"
              className={`h-4 w-4 rounded-sm border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${getSeatClass(status)}`}
              role="gridcell"
              aria-label={`${seat.id}, row ${seat.row}, seat ${seat.column}, ${status}, $${seat.price}`}
              aria-pressed={isSelected}
              disabled={seat.status === 'sold' || seat.status === 'held'}
              title={`${seat.id} · ${seat.section} · $${seat.price} · ${status}`}
              onClick={() => toggleSeat(seat)}
            />
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {(['available', 'premium', 'accessible', 'held', 'sold', 'selected'] as SeatStatus[]).map((status) => (
            <span key={status} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-sm border ${getSeatClass(status)}`} /> {status}
            </span>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-right font-mono text-xs text-slate-300">
          <div>{selectedSeatIds.length} seats selected</div>
          <div className="text-lg font-black text-emerald-300">${total}</div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50" />
    </div>
  );
});

CyberArena.displayName = 'CyberArena';

export default CyberArena;
