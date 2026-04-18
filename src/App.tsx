import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Globe2, Map as MapIcon, ChevronLeft, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import * as topojson from 'topojson-client';

import { MapDisplay } from './components/MapDisplay';
import { GuessInput } from './components/GuessInput';
import { GameMode, Country, GameState, Subdivision } from './types';
import { SUPPORTED_SUBDIVISION_COUNTRIES, WORLD_DATA_URL, ADMIN1_DATA_URL } from './data';
import { cn } from './lib/utils';
import { Lightbulb, Loader2 } from 'lucide-react';
import { playSound } from './lib/audio';

const ROUND_TIME = 30;

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    mode: 'WORLD',
    score: 0,
    totalAttempts: 0,
    currentFeatureAttempts: 0,
    status: 'LOADING',
    subdivisions: [],
    timeLeft: ROUND_TIME,
    playedIds: []
  });

  const [worldData, setWorldData] = useState<any[]>([]);
  const [allSubdivisionData, setAllSubdivisionData] = useState<any[]>([]);
  const [subdivisionFeatures, setSubdivisionFeatures] = useState<any[]>([]);
  const [currentFeature, setCurrentFeature] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  // Initial Load - World Data
  useEffect(() => {
    async function loadResources() {
      try {
        const [worldRes, admin1Res] = await Promise.all([
          fetch(WORLD_DATA_URL),
          fetch(ADMIN1_DATA_URL)
        ]);

        const [worldRaw, admin1Raw] = await Promise.all([
          worldRes.json(),
          admin1Res.json()
        ]);

        // Remove small islands or territories with no name for world data
        const worldFeatures = worldRaw.features.filter((f: any) => f.properties.name && f.geometry);
        setWorldData(worldFeatures);
        
        // Store all subdivision features globally
        setAllSubdivisionData(admin1Raw.features);
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to load global data', err);
      }
    }
    loadResources();
  }, []);

  // Countdown Timer
  useEffect(() => {
    let timer: any;
    if (gameState.status === 'PLAYING' && gameState.timeLeft > 0) {
      timer = setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 6 && prev.timeLeft > 1) {
            playSound('tick');
          }
          return {
            ...prev,
            timeLeft: Math.max(0, prev.timeLeft - 1)
          }
        });
      }, 1000);
    } else if (gameState.timeLeft === 0 && gameState.status === 'PLAYING') {
      // Time's up! Handle as an incorrect guess
      // To trigger sounds correctly, we invoke it here but handleGuess checks the actual guess logic
      handleGuess(""); 
    }

    return () => clearInterval(timer);
  }, [gameState.status, gameState.timeLeft]);

  const startNewRound = useCallback(async (mode?: GameMode, countryCode?: string) => {
    setLoading(true);
    const activeMode = mode || gameState.mode;
    
    let currentPlayedIds = gameState.playedIds || [];
    if ((mode && mode !== gameState.mode) || (countryCode && countryCode !== gameState.currentCountry?.code)) {
      currentPlayedIds = [];
    }

    try {
      if (activeMode === 'WORLD') {
        let available = worldData.filter(f => !currentPlayedIds.includes(f.properties.name));
        if (available.length === 0) {
          available = worldData;
          currentPlayedIds = [];
        }
        
        const random = available[Math.floor(Math.random() * available.length)];
        setCurrentFeature(random);
        setGameState(prev => ({
          ...prev,
          mode: 'WORLD',
          status: 'PLAYING',
          lastGuess: undefined,
          isCorrect: undefined,
          currentFeatureAttempts: 0,
          timeLeft: ROUND_TIME,
          playedIds: [...currentPlayedIds, random.properties.name]
        }));
        setHint(null);
      } else {
        // Subdivisions Mode
        let features = subdivisionFeatures;
        let selectedCountry = gameState.currentCountry;

        // If a new country is selected OR features aren't loaded yet for the current selection
        if (countryCode) {
          const country = SUPPORTED_SUBDIVISION_COUNTRIES.find(c => c.code === countryCode);
          if (!country) throw new Error('Country not supported');
          selectedCountry = country;

          // Filter our pre-loaded admin1 data by the selected country's ISO2
          // We use iso_a2 from Natural Earth data
          features = allSubdivisionData.filter((f: any) => 
            f.properties.iso_a2?.toUpperCase() === country.iso2.toUpperCase() && 
            (f.properties.NAME || f.properties.name) && 
            f.geometry
          );
          
          if (features.length === 0) {
            // Fallback: try filtering by country name if ISO2 doesn't match perfectly
            features = allSubdivisionData.filter((f: any) => 
               (f.properties.admin === country.name || f.properties.admin?.includes(country.name)) &&
               (f.properties.NAME || f.properties.name) &&
               f.geometry
            );
          }

          setSubdivisionFeatures(features);
        }

        if (features.length === 0) {
          throw new Error('No subdivision map data found for this region');
        }

        const subdivisionsList = features.map((f: any) => ({
          name: f.properties.NAME || f.properties.name,
          id: f.id || f.properties.allmini || f.properties.NAME || f.properties.name
        }));

        let available = features.filter((f: any) => !currentPlayedIds.includes(f.properties.NAME || f.properties.name));
        if (available.length === 0) {
          available = features;
          currentPlayedIds = [];
        }

        const random = available[Math.floor(Math.random() * available.length)];
        setCurrentFeature(random);
        
        setGameState(prev => ({
          ...prev,
          mode: 'SUBDIVISIONS',
          currentCountry: selectedCountry,
          subdivisions: subdivisionsList,
          status: 'PLAYING',
          lastGuess: undefined,
          isCorrect: undefined,
          currentFeatureAttempts: 0,
          timeLeft: ROUND_TIME,
          playedIds: [...currentPlayedIds, random.properties.NAME || random.properties.name]
        }));
        setHint(null);
      }
      playSound('start');
    } catch (err) {
      console.error('Map Link Interrupted:', err);
      // Surface informative error to user or reset
      setGameState(prev => ({ ...prev, status: 'LOADING' }));
    } finally {
      setLoading(false);
    }
  }, [worldData, allSubdivisionData, subdivisionFeatures, gameState.mode, gameState.currentCountry, gameState.playedIds]);

  const handleGuess = (guess: string) => {
    const isWorld = gameState.mode === 'WORLD';
    const correctAnswer = isWorld 
      ? currentFeature.properties.name 
      : (currentFeature.properties.NAME || currentFeature.properties.name);

    // Normalize comparison
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedAnswer = correctAnswer.toLowerCase().trim();

    const isCorrect = normalizedGuess === normalizedAnswer;

    setGameState(prev => {
      const newAttempts = prev.currentFeatureAttempts + 1;
      const isFailure = !isCorrect && newAttempts >= 3;

      if (isCorrect) {
        playSound('success');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#22c55e', '#ffffff']
        });
      } else if (isFailure) {
        playSound('fail');
      } else {
        playSound('wrong');
      }

      // Always go to FEEDBACK state so the user sees they lost a life clearly
      return {
        ...prev,
        score: isCorrect ? prev.score + 1 : prev.score,
        totalAttempts: (isCorrect || isFailure) ? prev.totalAttempts + 1 : prev.totalAttempts,
        currentFeatureAttempts: newAttempts,
        status: 'FEEDBACK',
        lastGuess: guess,
        isCorrect
      };
    });
    setHint(null);
  };

  const handleRequestHint = () => {
    if (hint) return;
    const locationName = gameState.mode === 'WORLD' 
      ? currentFeature.properties.name 
      : (currentFeature.properties.NAME || currentFeature.properties.name);
    
    // Generate letter mask hint (e.g., India -> I___A)
    const maskedHint = locationName
      .split(' ')
      .map((word: string) => {
        if (word.length <= 2) return word.toUpperCase();
        const first = word[0].toUpperCase();
        const last = word[word.length - 1].toUpperCase();
        const blanks = '_'.repeat(word.length - 2);
        return `${first}${blanks}${last}`;
      })
      .join('   ');
      
    setHint(maskedHint);
  };

  const guessOptions = useMemo(() => {
    if (gameState.mode === 'WORLD') {
      return worldData.map(f => f.properties.name);
    } else {
      return gameState.subdivisions.map(s => s.name);
    }
  }, [gameState.mode, worldData, gameState.subdivisions]);

  if (gameState.status === 'LOADING' && !worldData.length) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 border-4 border-yellow/20 border-t-coral rounded-full animate-spin mx-auto shadow-sm" />
          <p className="font-semibold text-text-dark/60 uppercase tracking-widest text-xs animate-pulse">Initializing Interface...</p>
        </div>
      </div>
    );
  }

  // --- RENDERING ---

  if (gameState.status === 'LOADING' && worldData.length > 0 && gameState.mode === 'WORLD' && !currentFeature) {
    // Mode selection screen
    return (
      <div className="min-h-screen bg-bg-dark text-text-dark px-6 md:px-12 flex flex-col overflow-x-hidden pt-12 font-sans selection:bg-coral/20">
        <div className="max-w-6xl mx-auto w-full space-y-12">
          <header className="space-y-4 text-center">
            <h1 className="text-6xl md:text-8xl font-black tracking-tight text-text-dark">
              Border<span className="text-coral">Quest</span>
            </h1>
            <p className="text-text-dark/50 font-medium text-sm tracking-widest uppercase">Global Identification Matrix</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* World Mode Card */}
            <motion.button
              whileHover={{ scale: 1.02, rotate: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => startNewRound('WORLD')}
              className="group relative h-80 rounded-[3rem] overflow-hidden border border-white/60 hover:border-turquoise/50 transition-all duration-500 text-left bg-white/50 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] backdrop-blur-3xl"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/60 to-transparent z-10" />
              <img 
                src="https://picsum.photos/seed/vintage-map/800/400?grayscale" 
                className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:scale-110 mix-blend-multiply transition-all duration-700"
                referrerPolicy="no-referrer"
                alt="World"
              />
              <div className="absolute bottom-0 left-0 p-8 z-20 space-y-2">
                <Globe2 className="text-coral mb-4" size={48} strokeWidth={1.5} />
                <h3 className="text-3xl font-bold tracking-tight text-text-dark">World Explorer</h3>
                <p className="text-text-dark/60 font-medium text-xs uppercase tracking-widest leading-tight">Identify country shapes</p>
              </div>
            </motion.button>

            {/* Countries Mode Card */}
            <div className="flex flex-col h-80 bg-white/50 backdrop-blur-3xl rounded-[3rem] border border-white/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="flex items-center gap-4 p-8 border-b border-white/40 shrink-0">
                <MapIcon className="text-turquoise" size={28} strokeWidth={1.5} />
                <h3 className="font-semibold uppercase tracking-widest text-sm text-text-dark">Internal Borders</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="grid grid-cols-2 gap-3">
                  {SUPPORTED_SUBDIVISION_COUNTRIES.map((country) => (
                    <motion.button
                      key={country.code}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.8)', scale: 1.02 }}
                      onClick={() => startNewRound('SUBDIVISIONS', country.code)}
                      className="bg-white/40 rounded-2xl border border-white/50 flex items-center p-3 gap-3 text-left group transition-all shadow-sm"
                    >
                      <img 
                        src={`https://flagcdn.com/w40/${country.iso2}.png`} 
                        alt={country.name}
                        className="w-6 h-4 object-cover rounded shadow-sm opacity-90 group-hover:opacity-100"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[11px] font-semibold text-text-dark/80 group-hover:text-text-dark transition-colors uppercase truncate tracking-wide">
                        {country.name}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark text-text-dark flex flex-col font-sans">
      <header className="px-4 py-4 md:px-10 md:py-6 bg-white/70 backdrop-blur-3xl flex flex-col md:flex-row justify-between items-center shrink-0 border-b border-white/40 shadow-sm gap-4 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <button 
            onClick={() => {
              setGameState(prev => ({ 
                ...prev, 
                status: 'LOADING', 
                mode: 'WORLD', 
                currentCountry: undefined,
                score: 0,
                totalAttempts: 0,
                currentFeatureAttempts: 0,
                playedIds: []
              }));
              setCurrentFeature(null);
            }}
            className="text-text-dark/40 hover:text-coral hover:scale-110 transition-all p-2 -ml-2"
          >
            <ChevronLeft size={28} strokeWidth={2.5} className="md:w-8 md:h-8" />
          </button>
          <div className="text-xl md:text-2xl font-bold tracking-tight text-text-dark">BorderQuest</div>
          <div className="w-10 h-10 md:hidden" /> {/* Spacer for centering on mobile */}
        </div>

        <div className="flex gap-2 md:gap-6 w-full md:w-auto overflow-x-auto hide-scrollbar pb-1 md:pb-0 justify-center">
          <div className="flex flex-col items-center justify-center flex-1 md:flex-none min-w-[80px] md:min-w-[120px] px-3 md:px-6 py-2 bg-white/50 backdrop-blur-xl rounded-2xl md:rounded-[1.5rem] border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-text-dark/50 font-semibold mb-0.5">Time</div>
            <div className={cn(
              "text-xl md:text-3xl font-semibold tabular-nums tracking-tighter transition-colors",
              gameState.timeLeft <= 5 ? "text-coral animate-pulse" : "text-yellow"
            )}>
              {gameState.timeLeft}s
            </div>
          </div>
          <div className="flex flex-col items-center justify-center flex-1 md:flex-none min-w-[80px] md:min-w-[120px] px-3 md:px-6 py-2 bg-white/50 backdrop-blur-xl rounded-2xl md:rounded-[1.5rem] border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-text-dark/50 font-semibold mb-0.5">Score</div>
            <div className="text-xl md:text-3xl font-semibold text-turquoise tabular-nums tracking-tighter">{gameState.score}</div>
          </div>
          <div className="flex flex-col items-center justify-center flex-1 md:flex-none min-w-[80px] md:min-w-[120px] px-3 md:px-6 py-2 bg-white/50 backdrop-blur-xl rounded-2xl md:rounded-[1.5rem] border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
            <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-text-dark/50 font-semibold mb-0.5">Attempt</div>
            <div className="text-xl md:text-3xl font-semibold text-coral tabular-nums tracking-tighter">{gameState.totalAttempts + 1}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:gap-8 p-4 md:p-12">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-4">
          <div className={cn(
            "p-6 rounded-[2rem] transition-all cursor-default border",
            gameState.mode === 'WORLD' ? "bg-turquoise/20 text-turquoise border-turquoise/30 shadow-sm" : "bg-white/40 border-white/40 text-text-dark/50"
          )}>
            <h3 className="font-semibold text-sm tracking-wide">World Explorer</h3>
            <p className="text-[11px] font-medium opacity-80 uppercase tracking-wider leading-tight mt-1">Identify country shapes</p>
          </div>
          <div className={cn(
            "p-6 rounded-[2rem] transition-all cursor-default border",
            gameState.mode === 'SUBDIVISIONS' ? "bg-turquoise/20 text-turquoise border-turquoise/30 shadow-sm" : "bg-white/40 border-white/40 text-text-dark/50"
          )}>
            <h3 className="font-semibold text-sm tracking-wide">Internal Borders</h3>
            <p className="text-[11px] font-medium opacity-80 uppercase tracking-wider leading-tight mt-1">
              {gameState.currentCountry ? gameState.currentCountry.name : "Select a country"}
            </p>
          </div>
          
          <div className="mt-auto p-6 bg-white/40 border border-white/50 rounded-[2rem]">
            <div className="text-[10px] uppercase font-bold text-text-dark/40 tracking-widest mb-2">Target Data</div>
            <div className="text-xs font-mono font-medium text-text-dark/60">OBJ_REF_ID: #{Math.floor(Math.random() * 9999)}</div>
          </div>
        </aside>

        {/* Game View */}
        <section className="bg-white/60 backdrop-blur-3xl rounded-3xl md:rounded-[3rem] border border-white max-w-5xl w-full mx-auto shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] relative flex flex-col overflow-hidden items-center justify-between min-h-[70vh] md:min-h-0 pt-4 md:pt-8">
          
          {/* Top visual area inside the game section */}
          <div className="relative flex-1 flex flex-col items-center w-full min-h-[300px]">
            {/* Progress Dots */}
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 flex gap-1.5 md:gap-3 z-10">
              {[...Array(10)].map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all duration-500",
                    i < (gameState.totalAttempts % 10) ? "bg-turquoise scale-90" : 
                    i === (gameState.totalAttempts % 10) ? "bg-coral scale-125 shadow-sm" : 
                    "bg-text-dark/10"
                  )} 
                />
              ))}
            </div>

            <div className="absolute top-10 md:top-8 right-4 md:right-8 z-20 flex justify-end">
              <AnimatePresence mode="wait">
                {hint ? (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="max-w-[150px] md:max-w-[200px] p-2 md:p-4 bg-white/90 backdrop-blur-xl border border-white shadow-sm rounded-3xl text-center"
                  >
                    <p className="text-text-dark text-sm md:text-lg font-bold font-mono tracking-[0.2em] md:tracking-[0.3em] leading-tight break-all">{hint}</p>
                  </motion.div>
                ) : gameState.status === 'PLAYING' ? (
                  <button
                    onClick={handleRequestHint}
                    className="bg-white/80 hover:bg-white backdrop-blur-xl border border-white/80 shadow-sm text-text-dark p-2 px-4 rounded-full text-[10px] md:text-[11px] font-semibold uppercase tracking-widest transition-all flex items-center gap-1.5 md:gap-2"
                  >
                    <Lightbulb size={12} className="text-yellow md:w-3.5 md:h-3.5" />
                    Reveal Hint
                  </button>
                ) : null}
              </AnimatePresence>
            </div>

            <MapDisplay feature={currentFeature} isLoading={loading} />
          </div>

          {/* Interaction Layer (No longer absolute, sits naturally at the bottom and forces window scrollability) */}
          <div className="w-full px-4 md:px-8 pb-6 md:pb-8 flex flex-col items-center shrink-0 z-30">
            <AnimatePresence mode="wait">
              {gameState.status === 'PLAYING' ? (
                <motion.div
                  key="playing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col items-center gap-2"
                >
                  <div className="w-full max-w-sm mb-4 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                    <div className="text-xs font-semibold uppercase text-text-dark/80 tracking-widest flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-yellow animate-pulse" />
                      Chances
                    </div>
                    <div className="flex gap-3">
                      {[1, 2, 3].map(i => (
                        <div 
                          key={i}
                          className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500",
                            i <= (3 - gameState.currentFeatureAttempts)
                              ? "border-turquoise/30 bg-turquoise/10 text-turquoise shadow-sm scale-100"
                              : "border-coral/20 bg-coral/5 text-coral/40 scale-90"
                          )}
                        >
                          {i > (3 - gameState.currentFeatureAttempts) && <XCircle size={20} strokeWidth={2.5} />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <GuessInput 
                    options={guessOptions} 
                    onGuess={handleGuess}
                    disabled={loading}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="feedback"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={cn(
                    "w-full max-w-sm p-6 rounded-[2rem] border bg-white/90 backdrop-blur-3xl flex items-center gap-5 shadow-[0_20px_40px_rgba(0,0,0,0.06)]",
                    gameState.isCorrect 
                      ? "border-turquoise/30" 
                      : "border-coral/30"
                  )}
                >
                  <div className={cn("shrink-0", gameState.isCorrect ? "text-turquoise" : "text-coral")}>
                    {gameState.isCorrect ? <CheckCircle2 size={36} strokeWidth={2.5} /> : <XCircle size={36} strokeWidth={2.5} />}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold uppercase text-sm tracking-wide text-text-dark">
                      {gameState.isCorrect ? 'Identified!' : (gameState.currentFeatureAttempts >= 3) ? "Failed!" : (gameState.timeLeft === 0 ? "Time's Up!" : 'Incorrect')}
                    </h3>
                    {(!gameState.isCorrect && gameState.currentFeatureAttempts >= 3) ? (
                      <div className="mt-1">
                        <div className="text-[10px] uppercase font-semibold text-text-dark/50 tracking-wider">Correct Answer:</div>
                        <div className="text-xl font-bold text-text-dark leading-none mt-1">
                          {gameState.mode === 'WORLD' ? currentFeature.properties.name : (currentFeature.properties.NAME || currentFeature.properties.name)}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] font-medium uppercase text-text-dark/60 mt-1">
                        {gameState.isCorrect 
                          ? `Verified: ${gameState.lastGuess}` 
                          : (gameState.timeLeft === 0 ? "You ran out of time! \u2022 Try again" : "Identification mismatch \u2022 Try again")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={gameState.isCorrect || gameState.currentFeatureAttempts >= 3 ? () => startNewRound() : () => setGameState(prev => ({ ...prev, status: 'PLAYING', timeLeft: ROUND_TIME }))}
                    className="p-3.5 bg-text-dark/5 hover:bg-text-dark/10 rounded-2xl transition-all flex items-center justify-center shrink-0 group shadow-sm text-text-dark"
                    title={gameState.isCorrect || gameState.currentFeatureAttempts >= 3 ? 'Next Target' : 'Try Again'}
                  >
                    <RotateCcw size={20} strokeWidth={2.5} className={cn("transition-transform duration-500", (!gameState.isCorrect && gameState.currentFeatureAttempts < 3) && "group-hover:rotate-180")} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="p-4 text-center text-text-dark/40 font-mono text-[10px] uppercase tracking-[0.2em] font-medium">
        BorderQuest • Reference Model 4.2
      </footer>
    </div>
  );
}
