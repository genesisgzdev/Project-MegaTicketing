import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Text, MeshDistortMaterial } from '@react-three/drei';
import { Physics, useBox, useSphere } from '@react-three/cannon';
import * as THREE from 'three';

function FileNode({ position, name, isError }: any) {
  // Define a physical box
  const [ref, api] = useBox(() => ({ 
    mass: 1, 
    position, 
    args: [0.5, 0.5, 0.5],
    damping: 0.1,
    angularDamping: 0.1
  }));

  const [hovered, setHover] = useState(false);

  // Apply impulse if an error occurs
  useEffect(() => {
    if (isError) {
      api.applyImpulse([
        (Math.random() - 0.5) * 10, 
        5 + Math.random() * 5, 
        (Math.random() - 0.5) * 10
      ], [0, 0, 0]);
    }
  }, [isError]);

  return (
    <mesh
      ref={ref as any}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial 
        color={isError ? '#ff0000' : hovered ? '#44aaff' : '#224488'} 
        emissive={isError ? '#ff0000' : '#000000'}
        emissiveIntensity={isError ? 5 : 0}
      />
      <Text
        position={[0, 0.6, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text>
    </mesh>
  );
}

function SecurityCore({ status }: any) {
  const [ref, api] = useSphere(() => ({ 
    type: 'Static', 
    args: [1], 
    position: [0, 0, 0] 
  }));
  
  return (
    <mesh ref={ref as any}>
      <sphereGeometry args={[1, 32, 32]} />
      <MeshDistortMaterial
        color={status === 'DANGER' ? '#ff3300' : status === 'ATTACK' ? '#ffaa00' : '#00ffaa'}
        speed={2}
        distort={0.4}
        radius={1}
      />
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.3}
        color="white"
      >
        {status === 'DANGER' ? 'BREACH' : status === 'ATTACK' ? 'DDoS ATTACK' : 'SECURE'}
      </Text>
    </mesh>
  );
}

function Ground() {
  const [ref] = useBox(() => ({ 
    type: 'Static', 
    rotation: [-Math.PI / 2, 0, 0], 
    position: [0, -5, 0],
    args: [100, 100, 1]
  }));
  return (
    <mesh ref={ref as any}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#050505" transparent opacity={0.5} />
    </mesh>
  );
}

export default function CyberArena() {
  const [sysStatus, setStatus] = useState('SECURE');
  const [errorFile, setErrorFile] = useState<string | null>(null);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3001/ws');
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'FILE_CHANGE' || data.type === 'ERROR_BOUNCE') {
        setErrorFile(data.file || 'api/index.ts');
        setTimeout(() => setErrorFile(null), 500);
      }
      if (data.type === 'SYSTEM_HEALTH' || data.type === 'ATTACK_STATUS') {
        setStatus(data.status);
      }
    };
    return () => socket.close();
  }, []);

  return (
    <div className="h-[600px] w-full bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,1)] relative">
      <Canvas camera={{ position: [0, 5, 12], fov: 50 }}>
        <color attach="background" args={['#010205']} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#4488ff" />
        
        <Physics gravity={[0, -9.81, 0]}>
          <SecurityCore status={sysStatus} />
          <Ground />
          
          <FileNode position={[-3, 2, 2]} name="api/index.ts" isError={errorFile?.includes('index.ts')} />
          <FileNode position={[3, 3, -2]} name="database/schema" isError={errorFile?.includes('schema')} />
          <FileNode position={[4, 2, 3]} name="shared/schemas" isError={errorFile?.includes('schemas')} />
          <FileNode position={[-5, 4, -4]} name="web/App.tsx" isError={errorFile?.includes('App.tsx')} />
        </Physics>

        <OrbitControls makeDefault />
      </Canvas>
      
      {sysStatus === 'ATTACK' && (
        <div className="absolute inset-0 pointer-events-none border-4 border-red-500/50 animate-pulse bg-red-500/5" />
      )}

      <div className="absolute bottom-6 left-6 text-white font-mono text-[10px] space-y-1 bg-black/80 p-4 backdrop-blur-md rounded-lg border border-white/10 z-30">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${sysStatus !== 'SECURE' ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
          GRID STATUS: {sysStatus}
        </div>
        <div className="text-slate-500 uppercase tracking-tighter">Physics Engine: Cannon.js v1.0</div>
        {errorFile && <div className="text-red-400 animate-bounce">IMPULSE DETECTED: {errorFile}</div>}
      </div>
    </div>
  );
}


