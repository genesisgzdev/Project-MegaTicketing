import { useState } from 'react';
import { Ticket, Users, Calendar, MapPin } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SEATS = Array.from({ length: 60 }, (_, i) => ({
  id: `seat-${i + 1}`,
  number: i + 1,
  status: Math.random() > 0.8 ? 'locked' : 'available',
  price: 120
}));

export default function App() {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  const toggleSeat = (id: string) => {
    setSelectedSeats(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <header className="mb-12 max-w-4xl mx-auto flex justify-between items-end border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            World Tour 2026
          </h1>
          <div className="mt-4 flex gap-6 text-slate-400">
            <span className="flex items-center gap-2"><Calendar size={18} /> April 24, 2026</span>
            <span className="flex items-center gap-2"><MapPin size={18} /> Madison Square Garden</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-sm uppercase tracking-widest">Total Price</p>
          <p className="text-3xl font-mono text-indigo-400">${selectedSeats.length * 120}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
        <section className="lg:col-span-2">
          <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-2xl">
            <div className="w-full h-2 bg-slate-700 rounded-full mb-12 shadow-[0_0_20px_rgba(51,65,85,0.5)] flex items-center justify-center text-[10px] text-slate-500 uppercase tracking-tighter">
              Stage
            </div>
            
            <div className="seat-grid">
              {SEATS.map(seat => (
                <button
                  key={seat.id}
                  disabled={seat.status === 'locked'}
                  onClick={() => toggleSeat(seat.id)}
                  className={cn(
                    "h-8 rounded-md transition-all duration-300 transform hover:scale-110",
                    seat.status === 'locked' && "bg-slate-800 cursor-not-allowed opacity-50",
                    seat.status === 'available' && !selectedSeats.includes(seat.id) && "bg-slate-700 hover:bg-slate-600",
                    selectedSeats.includes(seat.id) && "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]"
                  )}
                  title={`Seat ${seat.number} - $${seat.price}`}
                />
              ))}
            </div>

            <div className="mt-12 flex justify-center gap-8 text-sm text-slate-400">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-700 rounded-sm" /> Available</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-sm" /> Selected</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-800 rounded-sm opacity-50" /> Taken</div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Ticket className="text-indigo-400" /> Summary
            </h2>
            <div className="space-y-3">
              {selectedSeats.length === 0 ? (
                <p className="text-slate-500 italic">No seats selected yet</p>
              ) : (
                selectedSeats.map(id => (
                  <div key={id} className="flex justify-between text-sm">
                    <span>Seat #{id.split('-')[1]}</span>
                    <span className="text-slate-400">$120.00</span>
                  </div>
                ))
              )}
            </div>
            {selectedSeats.length > 0 && (
              <button className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20">
                Purchase Tickets
              </button>
            )}
          </div>

          <div className="bg-slate-900/30 p-6 rounded-2xl border border-dashed border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
              <Users size={16} /> Real-time activity
            </h3>
            <p className="text-xs text-slate-500">
              1,240 people are looking at this event right now.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
