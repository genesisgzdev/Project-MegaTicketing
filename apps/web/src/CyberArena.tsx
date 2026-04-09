import React, { useMemo } from 'react';

/**
 * CyberArena: High-performance seat grid component.
 * Utilizes useMemo to prevent unnecessary re-renders of the static grid structure.
 */
const CyberArena = React.memo(() => {
  const gridSize = 400; // 20x20 grid

  const gridCells = useMemo(() => {
    return Array.from({ length: gridSize }).map((_, index) => (
      <div
        key={index}
        className="w-4 h-4 bg-slate-800 rounded-sm border border-slate-700/50 hover:bg-indigo-500/40 transition-colors duration-200 cursor-pointer"
        role="gridcell"
        aria-label={`Seat ${index + 1}`}
        tabIndex={0}
      />
    ));
  }, [gridSize]);

  return (
    <div className="relative w-full aspect-video bg-slate-900/50 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden p-8 flex items-center justify-center">
      <div 
        className="grid grid-cols-20 gap-2 max-w-full max-h-full overflow-auto custom-scrollbar p-4"
        role="grid"
        aria-label="Interactive Seat Map"
      >
        {gridCells}
      </div>
      
      {/* Decorative overlay to simulate stadium glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50" />
    </div>
  );
}
