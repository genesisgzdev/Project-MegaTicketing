import { useState, useEffect, useRef, useCallback } from 'react';
import { Ticket, Users, Calendar, MapPin, Zap, Activity, Shield, ShieldAlert, ShieldCheck, Globe, Database, Server } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CyberArena from './CyberArena';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAttacked, setIsAttacked] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [infraStatus, setInfraStatus] = useState({
    region: 'us-east-1',
    waf: 'Active',
    k8s: '3/3 Nodes Ready'
  });
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3001/ws');
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setLogs(prev => ['SYSTEM: Link Established with Edge Node', ...prev]);
    };
    socket.onclose = () => setIsConnected(false);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ATTACK_STATUS') {
        setIsAttacked(data.status === 'ATTACK');
      }
      if (data.type === 'LOG') {
        setLogs(prev => [data.message, ...prev].slice(0, 10));
      }
    };
    return () => socket.close();
  }, []);

  const toggleShield = useCallback(() => {
    const newStatus = !shieldActive;
    setShieldActive(newStatus);
    socketRef.current?.send(JSON.stringify({ 
      type: newStatus ? 'ACTIVATE_DEFENSE' : 'DEACTIVATE_DEFENSE' 
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 font-sans selection:bg-indigo-500/30">
      <header className="mb-12 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-800/50 pb-8 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">
              Global Deployment Center
            </span>
            {isAttacked && (
              <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-black uppercase tracking-[0.2em] animate-pulse">
                <ShieldAlert size={14} /> Edge Threat Detected
              </span>
            )}
          </div>
          <h1 className="text-6xl font-extrabold tracking-tighter bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent uppercase">
            Global Defense Arena
          </h1>
        </div>
        
        <div className="flex gap-4">
          <div className="hidden lg:flex gap-6 items-center px-6 py-2 border border-white/5 rounded-2xl bg-white/[0.02]">
            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-r border-white/10 pr-6">
              <Globe size={14} /> {infraStatus.region}
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-r border-white/10 pr-6">
              <Shield size={14} className="text-emerald-500" /> WAF: {infraStatus.waf}
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              <Server size={14} className="text-indigo-400" /> K8s: {infraStatus.k8s}
            </div>
          </div>
          
          <button 
            onClick={toggleShield}
            className={cn(
              "flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 shadow-2xl",
              shieldActive 
                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20 scale-105" 
                : "bg-slate-900 text-slate-400 border border-white/5 hover:border-indigo-500/50 hover:text-indigo-400"
            )}
          >
            {shieldActive ? <ShieldCheck /> : <Shield size={18} />}
            {shieldActive ? 'WAF Shield Active' : 'Activate Global Defense'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
        <section className="xl:col-span-9 relative">
          <div className="absolute top-6 left-6 z-20 flex items-center gap-2 bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
            <Activity size={12} /> Infrastructure Topology
          </div>
          <CyberArena />
        </section>

        <div className="xl:col-span-3 space-y-8">
          <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2rem] border border-white/5 shadow-2xl">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <Zap size={18} className="text-indigo-400" /> System Metrics
            </h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  <span>API Response</span>
                  <span className="text-emerald-400">14ms</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-[15%] h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  <span>Memory Usage</span>
                  <span className="text-indigo-400">256MB</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-[45%] h-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 font-mono text-[10px] text-slate-500 space-y-3">
                <p className="flex items-center gap-2"><Database size={12} /> PG Transaction Log: OK</p>
                <p className="flex items-center gap-2"><Zap size={12} className="text-amber-500" /> Redis Cluster: 1 Node</p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] p-8 rounded-[2rem] border border-white/5">
            <h3 className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-widest">Global Event Stream</h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {logs.map((log, i) => (
                <div key={i} className="flex flex-col gap-1 border-l-2 border-indigo-500/20 pl-4">
                  <span className="text-[9px] text-slate-600 uppercase">{new Date().toLocaleTimeString()}</span>
                  <span className={cn("text-[10px] font-medium", log.includes('SHIELD') ? 'text-emerald-400' : 'text-slate-400')}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


