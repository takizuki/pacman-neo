/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, Skull, Star, Keyboard, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Constants ---
const CELL_SIZE = 24;
const GRID_WIDTH = 19;
const GRID_HEIGHT = 21;

/**
 * Grid values:
 * 0: Empty path
 * 1: Wall
 * 2: Pellet
 * 3: Power Pellet
 */
const BOARD_LAYOUT = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,1,0,1,1,0,1,2,1,1,1,1],
  [1,0,0,0,2,0,0,1,0,0,0,1,0,0,0,2,0,0,1],
  [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,3,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null;

interface Ghost {
  pos: Point;
  dir: Direction;
  color: string;
  isFrightened: boolean;
  spawnPos: Point;
}

const COLORS = {
  wall: '#00d2ff',      // Neon Blue
  pellet: '#ffffff',
  powerPellet: '#f1f500', // Neon Yellow
  pacman: '#f1f500',     // Neon Yellow
  background: 'rgba(0, 0, 0, 0.4)',
  ghosts: ['#ff00c1', '#00d2ff', '#39ff14', '#ffa500'], // Pink, Cyan, Green, Orange
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'WON'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(50000);
  const [lives, setLives] = useState(3);
  const [board, setBoard] = useState<number[][]>(BOARD_LAYOUT.map(row => [...row]));

  const pacmanRef = useRef({
    pos: { x: 9, y: 15 },
    dir: null as Direction,
    nextDir: null as Direction,
    rotation: 0,
    mouthOpen: 0,
  });

  const ghostsRef = useRef<Ghost[]>(COLORS.ghosts.map((color, i) => ({
    pos: { x: 8 + (i % 3), y: 9 },
    dir: 'UP',
    color,
    isFrightened: false,
    spawnPos: { x: 8 + (i % 3), y: 9 },
  })));

  const startTimeRef = useRef<number>(0);
  const frightenedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const resetPositions = useCallback(() => {
    pacmanRef.current = {
      pos: { x: 9, y: 15 },
      dir: null,
      nextDir: null,
      rotation: 0,
      mouthOpen: 0,
    };
    ghostsRef.current = ghostsRef.current.map((ghost, i) => ({
      ...ghost,
      pos: { ...ghost.spawnPos },
      dir: 'UP',
      isFrightened: false,
    }));
  }, []);

  const startGame = () => {
    setBoard(BOARD_LAYOUT.map(row => [...row]));
    setScore(0);
    setLives(3);
    resetPositions();
    startTimeRef.current = performance.now();
    setGameState('PLAYING');
  };

  const isWall = (x: number, y: number) => {
    if (x < 0 || x >= GRID_WIDTH) return false;
    if (y < 0 || y >= GRID_HEIGHT) return true;
    return board[y][x] === 1;
  };

  const update = (time: number) => {
    if (gameState !== 'PLAYING') return;

    const elapsedSeconds = (time - startTimeRef.current) / 1000;
    // Starts at 250ms (slow) and speeds up to 100ms (fast) over 60 seconds
    const targetInterval = Math.max(100, 250 - (elapsedSeconds * 2.5));

    const dt = time - lastTimeRef.current;
    if (dt < targetInterval) {
      frameRef.current = requestAnimationFrame(update);
      return;
    }
    lastTimeRef.current = time;

    const pac = pacmanRef.current;
    
    if (pac.nextDir) {
      let nextX = pac.pos.x, nextY = pac.pos.y;
      if (pac.nextDir === 'UP') nextY--;
      if (pac.nextDir === 'DOWN') nextY++;
      if (pac.nextDir === 'LEFT') nextX--;
      if (pac.nextDir === 'RIGHT') nextX++;

      if (!isWall(nextX, nextY)) {
        pac.dir = pac.nextDir;
        pac.nextDir = null;
      }
    }

    if (pac.dir) {
      let nextX = pac.pos.x, nextY = pac.pos.y;
      if (pac.dir === 'UP') { nextY--; pac.rotation = -Math.PI / 2; }
      if (pac.dir === 'DOWN') { nextY++; pac.rotation = Math.PI / 2; }
      if (pac.dir === 'LEFT') { nextX--; pac.rotation = Math.PI; }
      if (pac.dir === 'RIGHT') { nextX++; pac.rotation = 0; }

      if (nextX < 0) nextX = GRID_WIDTH - 1;
      if (nextX >= GRID_WIDTH) nextX = 0;

      if (!isWall(nextX, nextY)) {
        pac.pos = { x: nextX, y: nextY };
        const cell = board[nextY][nextX];
        if (cell === 2) {
          const newBoard = board.map(r => [...r]);
          newBoard[nextY][nextX] = 0;
          setBoard(newBoard);
          setScore(s => s + 10);
        } else if (cell === 3) {
          const newBoard = board.map(r => [...r]);
          newBoard[nextY][nextX] = 0;
          setBoard(newBoard);
          setScore(s => s + 50);
          ghostsRef.current.forEach(g => g.isFrightened = true);
          if (frightenedTimerRef.current) clearTimeout(frightenedTimerRef.current);
          frightenedTimerRef.current = setTimeout(() => {
            ghostsRef.current.forEach(g => g.isFrightened = false);
          }, 8000);
        }
      }
    }

    ghostsRef.current.forEach(ghost => {
      const possibleDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      const oppositeDir: Record<string, Direction> = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };
      
      const validDirs = possibleDirs.filter(d => {
        if (ghost.dir && d === oppositeDir[ghost.dir]) return false;
        let nx = ghost.pos.x, ny = ghost.pos.y;
        if (d === 'UP') ny--;
        if (d === 'DOWN') ny++;
        if (d === 'LEFT') nx--;
        if (d === 'RIGHT') nx++;
        return !isWall(nx, ny);
      });

      if (validDirs.length > 0) {
        const target = ghost.isFrightened ? { x: GRID_WIDTH - pac.pos.x, y: GRID_HEIGHT - pac.pos.y } : pac.pos;
        validDirs.sort((a, b) => {
          const dist = (d: Direction) => {
            let nx = ghost.pos.x, ny = ghost.pos.y;
            if (d === 'UP') ny--;
            if (d === 'DOWN') ny++;
            if (d === 'LEFT') nx--;
            if (d === 'RIGHT') nx++;
            return Math.sqrt(Math.pow(nx - target.x, 2) + Math.pow(ny - target.y, 2));
          };
          return dist(a!) - dist(b!);
        });
        ghost.dir = Math.random() < 0.8 ? validDirs[0] : validDirs[Math.floor(Math.random() * validDirs.length)];
      } else if (ghost.dir) {
        ghost.dir = oppositeDir[ghost.dir];
      }

      if (ghost.dir) {
        let nx = ghost.pos.x, ny = ghost.pos.y;
        if (ghost.dir === 'UP') ny--;
        if (ghost.dir === 'DOWN') ny++;
        if (ghost.dir === 'LEFT') nx--;
        if (ghost.dir === 'RIGHT') nx++;
        if (nx < 0) nx = GRID_WIDTH - 1;
        if (nx >= GRID_WIDTH) nx = 0;
        if (!isWall(nx, ny)) ghost.pos = { x: nx, y: ny };
      }

      if (ghost.pos.x === pac.pos.x && ghost.pos.y === pac.pos.y) {
        if (ghost.isFrightened) {
          ghost.pos = { ...ghost.spawnPos };
          ghost.isFrightened = false;
          setScore(s => s + 200);
        } else {
          setLives(l => {
            if (l <= 1) { setGameState('GAMEOVER'); return 0; }
            resetPositions();
            return l - 1;
          });
        }
      }
    });

    const hasPellets = board.some(row => row.includes(2) || row.includes(3));
    if (!hasPellets) setGameState('WON');

    draw();
    frameRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 1) {
          ctx.strokeStyle = COLORS.wall;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 5;
          ctx.shadowColor = COLORS.wall;
          ctx.beginPath();
          ctx.roundRect(x * CELL_SIZE + 4, y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8, 4);
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (cell === 2) {
          ctx.fillStyle = COLORS.pellet;
          ctx.beginPath();
          ctx.arc(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === 3) {
          ctx.fillStyle = COLORS.powerPellet;
          ctx.beginPath();
          ctx.arc(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 10; ctx.shadowColor = COLORS.powerPellet; ctx.stroke(); ctx.shadowBlur = 0;
        }
      });
    });

    const pac = pacmanRef.current;
    ctx.save();
    ctx.translate(pac.pos.x * CELL_SIZE + CELL_SIZE/2, pac.pos.y * CELL_SIZE + CELL_SIZE/2);
    ctx.rotate(pac.rotation);
    const mouthSize = Math.sin(Date.now() / 100) * 0.2 + 0.2;
    ctx.fillStyle = COLORS.pacman;
    ctx.shadowBlur = 15; ctx.shadowColor = COLORS.pacman;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, CELL_SIZE/2 - 2, mouthSize, Math.PI * 2 - mouthSize); ctx.fill();
    ctx.restore(); ctx.shadowBlur = 0;

    ghostsRef.current.forEach(ghost => {
      ctx.save();
      ctx.translate(ghost.pos.x * CELL_SIZE + CELL_SIZE/2, ghost.pos.y * CELL_SIZE + CELL_SIZE/2);
      ctx.fillStyle = ghost.isFrightened ? '#3b82f6' : ghost.color;
      ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle as string;
      ctx.beginPath(); ctx.arc(0, -2, CELL_SIZE/2 - 4, Math.PI, 0); ctx.lineTo(CELL_SIZE/2 - 4, CELL_SIZE/2 - 4);
      for (let i = 0; i < 3; i++) {
        const x = (CELL_SIZE/2 - 4) - (i * (CELL_SIZE - 8) / 2);
        ctx.lineTo(x, (i % 2 === 0) ? CELL_SIZE/2 - 2 : CELL_SIZE/2 - 6);
      }
      ctx.lineTo(-(CELL_SIZE/2 - 4), CELL_SIZE/2 - 4); ctx.fill();
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-4, -4, 3, 0, Math.PI * 2); ctx.arc(4, -4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-4, -4, 1.5, 0, Math.PI * 2); ctx.arc(4, -4, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); ctx.shadowBlur = 0;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys: Record<string, Direction> = {
        'ArrowUp': 'UP', 'w': 'UP', 'ArrowDown': 'DOWN', 's': 'DOWN',
        'ArrowLeft': 'LEFT', 'a': 'LEFT', 'ArrowRight': 'RIGHT', 'd': 'RIGHT'
      };
      if (keys[e.key]) { pacmanRef.current.nextDir = keys[e.key]; e.preventDefault(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      lastTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(frameRef.current);
    }
    return () => cancelAnimationFrame(frameRef.current);
  }, [gameState, board]);

  return (
    <div className="h-screen w-screen bg-[#0f0c29] bg-[linear-gradient(135deg,#0f0c29_0%,#302b63_50%,#24243e_100%)] text-white font-sans selection:bg-[#00d2ff]/30 flex flex-col xl:flex-row overflow-hidden fixed inset-0">
      
      {/* Sidebar - Stats & Controls (Desktop) / Header (Mobile) */}
      <aside className="w-full xl:w-[320px] h-auto xl:h-full flex flex-col p-1 xl:p-10 gap-2 xl:gap-6 z-10 shrink-0">
        <div className="bg-white/10 backdrop-blur-[20px] border border-white/15 rounded-xl xl:rounded-[24px] p-2 xl:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <header className="flex xl:block items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-xl xl:text-4xl font-black tracking-tighter italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#f1f500] to-white leading-none">
                PAC-NEO
              </h1>
              <p className="text-white/40 font-mono text-[7px] xl:text-[9px] uppercase tracking-[0.3em] mt-0.5 xl:mt-1">Next Gen Arcade</p>
            </div>
            
            <div className="xl:hidden flex items-center gap-3">
              <div className="text-right flex items-center gap-2">
                <div className="flex flex-col">
                  <p className="text-[7px] uppercase tracking-[1px] text-white/50 leading-none mb-0.5">Score</p>
                  <p className="text-base font-mono font-bold leading-none">{score.toLocaleString()}</p>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex flex-col items-center">
                  <p className="text-[7px] uppercase tracking-[1px] text-white/50 leading-none mb-0.5">Lives</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < lives ? "bg-[#f1f500]" : "bg-white/10"}`} style={{ clipPath: 'polygon(100% 0, 100% 40%, 50% 50%, 100% 60%, 100% 100%, 0 100%, 0 0)' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="hidden xl:block space-y-6 mt-6">
            <div>
              <p className="text-[11px] uppercase tracking-[2px] text-white/50 mb-1">Score</p>
              <p className="text-3xl font-mono font-bold text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                {score.toLocaleString()}
              </p>
            </div>
            
            <div>
              <p className="text-[11px] uppercase tracking-[2px] text-white/50 mb-1">High Score</p>
              <p className="text-3xl font-mono font-bold text-white/80 tabular-nums">
                {Math.max(score, highScore).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[2px] text-white/50 mb-1">Lives</p>
              <div className="flex gap-2.5 mt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-5 h-5 rounded-full transition-all duration-500 ${i < lives ? "bg-[#f1f500] shadow-[0_0_10px_#f1f500]" : "bg-white/5"}`} 
                    style={{ clipPath: 'polygon(100% 0, 100% 40%, 50% 50%, 100% 60%, 100% 100%, 0 100%, 0 0)' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-[20px] border border-white/15 rounded-[24px] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hidden xl:block">
          <div className="space-y-4">
             <div>
              <p className="text-[11px] uppercase tracking-[2px] text-white/50 mb-1">Current Map</p>
              <p className="text-sm font-bold tracking-tight">CYBER-CITY LEVEL 4</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[2px] text-white/50 mb-1">Bonus Multiplier</p>
              <p className="text-sm font-extrabold text-[#39ff14] drop-shadow-[0_0_8px_rgba(57,255,20,0.4)]">x2.5 ENERGY</p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-[20px] border border-white/15 rounded-[24px] p-4 xl:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] mt-auto hidden xl:block">
          <div className="flex flex-col items-center gap-4">
            <p className="text-[11px] uppercase tracking-[2px] text-white/50">Controls</p>
            <div className="flex flex-col gap-2 scale-90">
              <div className="flex justify-center">
                <kbd className="w-10 h-10 border border-white/15 bg-white/5 rounded-lg flex items-center justify-center font-bold text-lg">W</kbd>
              </div>
              <div className="flex gap-2">
                <kbd className="w-10 h-10 border border-white/15 bg-white/5 rounded-lg flex items-center justify-center font-bold text-lg">A</kbd>
                <kbd className="w-10 h-10 border border-white/15 bg-white/5 rounded-lg flex items-center justify-center font-bold text-lg">S</kbd>
                <kbd className="w-10 h-10 border border-white/15 bg-white/5 rounded-lg flex items-center justify-center font-bold text-lg">D</kbd>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Game Viewport */}
      <main className="flex-1 relative flex flex-col items-center justify-start xl:justify-center pt-2 xl:pt-10 overflow-hidden">
        {/* Mobile Stats Bar - Removed redundant bar, consolidated into header above */}
        
        {/* Background Decorative Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] xl:w-[800px] xl:h-[800px] border border-white/5 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] xl:w-[1000px] xl:h-[1000px] border border-white/5 rounded-full pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[456px] px-2"
        >
          {/* Maze Container */}
          <div className="relative p-2 xl:p-6 bg-black/40 border-2 xl:border-4 border-[#00d2ff] rounded-xl shadow-[0_0_40px_rgba(0,210,255,0.2)]">
            <canvas
              ref={canvasRef}
              width={GRID_WIDTH * CELL_SIZE}
              height={GRID_HEIGHT * CELL_SIZE}
              className="block w-full h-auto max-h-[50vh] xl:max-h-none"
            />

            <AnimatePresence>
              {gameState !== 'PLAYING' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 xl:p-8 text-center rounded-lg"
                >
                  {gameState === 'START' && (
                    <motion.div key="start" className="space-y-6 xl:space-y-8">
                      <div className="w-16 h-16 xl:w-24 xl:h-24 bg-[#f1f500]/10 rounded-full flex items-center justify-center mx-auto border border-[#f1f500]/20 animate-pulse">
                        <Play size={32} className="text-[#f1f500] fill-[#f1f500] xl:w-12 xl:h-12" />
                      </div>
                      <div className="space-y-1 xl:space-y-2">
                        <h2 className="text-2xl xl:text-4xl font-black uppercase tracking-tighter italic">Ready to Protocol?</h2>
                        <p className="text-white/40 text-[10px] xl:text-sm max-w-[280px] mx-auto leading-relaxed">
                          Navigate the cyber-grid. Harvest energy nodes. Avoid the system trackers.
                        </p>
                      </div>
                      <button 
                        onClick={startGame}
                        className="group relative px-8 xl:px-12 py-3 xl:py-5 bg-[#f1f500] text-[#0f0c29] font-black uppercase tracking-tight overflow-hidden rounded-[20px] hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(241,245,0,0.5)]"
                      >
                        <span className="relative z-10 flex items-center gap-2 xl:gap-3 text-sm xl:text-base">Initialize Sequence <Star size={16} className="fill-[#0f0c29] xl:w-5 xl:h-5" /></span>
                        <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      </button>
                    </motion.div>
                  )}

                  {gameState === 'GAMEOVER' && (
                    <motion.div key="gameover" className="space-y-6 xl:space-y-8">
                      <Skull size={60} className="text-[#ff00c1] mx-auto drop-shadow-[0_0_20px_rgba(255,0,193,0.6)] xl:w-20 xl:h-20" />
                      <div>
                        <h2 className="text-3xl xl:text-5xl font-black uppercase tracking-tighter italic text-[#ff00c1] mb-1 xl:mb-2">Protocol Terminated</h2>
                        <p className="text-white/40 text-[10px] xl:text-sm uppercase font-mono tracking-widest leading-tight text-center">System Integrity Compromised<br/>Score: {score}</p>
                      </div>
                      <button 
                        onClick={startGame}
                        className="flex items-center gap-2 xl:gap-3 px-8 py-3 xl:px-10 xl:py-4 bg-white/10 border border-white/20 text-white font-bold uppercase tracking-tight rounded-full hover:bg-white/20 transition-all mx-auto backdrop-blur-sm text-sm xl:text-base"
                      >
                        <RotateCcw size={18} className="xl:w-5 xl:h-5" /> Reboot System
                      </button>
                    </motion.div>
                  )}

                  {gameState === 'WON' && (
                    <motion.div key="won" className="space-y-6 xl:space-y-8">
                      <Trophy size={60} className="text-[#39ff14] mx-auto drop-shadow-[0_0_20px_rgba(57,255,20,0.6)] xl:w-20 xl:h-20" />
                      <div>
                        <h2 className="text-3xl xl:text-5xl font-black uppercase tracking-tighter italic text-[#39ff14] mb-1 xl:mb-2">Network Breached</h2>
                        <p className="text-white/40 text-[10px] xl:text-sm uppercase font-mono tracking-widest text-center">Energy Extraction Complete<br/>Score: {score}</p>
                      </div>
                      <button 
                        onClick={startGame}
                        className="flex items-center gap-2 xl:gap-3 px-8 py-3 xl:px-10 xl:py-4 bg-[#39ff14] text-black font-bold uppercase tracking-tight rounded-full hover:bg-[#34e312] transition-colors mx-auto text-sm xl:text-base"
                      >
                        <RotateCcw size={18} className="xl:w-5 xl:h-5" /> Next Level
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Mobile D-Pad Controls */}
        <div className="xl:hidden grid grid-cols-3 gap-2 mt-2 z-10 scale-[0.85]">
          <div />
          <button 
            className="w-11 h-11 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center active:bg-[#f1f500] active:text-black transition-all shadow-lg active:scale-95 touch-none"
            onTouchStart={(e) => { e.preventDefault(); pacmanRef.current.nextDir = 'UP'; }}
          >
            <ChevronUp size={24} />
          </button>
          <div />
          
          <button 
            className="w-11 h-11 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center active:bg-[#f1f500] active:text-black transition-all shadow-lg active:scale-95 touch-none"
            onTouchStart={(e) => { e.preventDefault(); pacmanRef.current.nextDir = 'LEFT'; }}
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            className="w-11 h-11 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center active:bg-[#f1f500] active:text-black transition-all shadow-lg active:scale-95 touch-none"
            onTouchStart={(e) => { e.preventDefault(); pacmanRef.current.nextDir = 'DOWN'; }}
          >
            <ChevronDown size={24} />
          </button>
          <button 
            className="w-11 h-11 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center active:bg-[#f1f500] active:text-black transition-all shadow-lg active:scale-95 touch-none"
            onTouchStart={(e) => { e.preventDefault(); pacmanRef.current.nextDir = 'RIGHT'; }}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </main>
    </div>
  );
}
