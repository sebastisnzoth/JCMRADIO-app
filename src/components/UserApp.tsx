import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { AppConfig, RadioInfo } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Instagram, Facebook, Share2, Users, Radio, History, Volume2, VolumeX } from 'lucide-react';

const STREAM_URL = 'https://sp.aljania.com/8120/stream';

/* ─── Waveform ───────────────────────────────────────────────── */
const BAR_H = [8,14,22,28,18,30,16,32,24,12,26,20,30,10,22,28,16,24,14,10];
const BAR_D = [.6,.8,.55,.9,.7,.5,.85,.65,.75,.6,.9,.55,.7,.8,.6,.75,.85,.65,.7,.8];
const BAR_L = [0,.1,.25,.05,.35,.15,.45,.2,.3,.5,.08,.4,.18,.55,.28,.12,.42,.22,.38,.06];

function AudioWaveform({ active }: { active: boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3.5, height:32 }}>
      {BAR_H.map((h, i) => (
        <div key={i} style={{
          width:3, height:h, borderRadius:2, background:'#ef4444',
          transformOrigin:'center',
          animation: active ? `waveBar ${BAR_D[i]}s ease-in-out ${BAR_L[i]}s infinite` : 'none',
          transform: active ? undefined : 'scaleY(0.12)',
          opacity:   active ? undefined : 0.2,
          transition:'transform .4s ease, opacity .4s ease',
        }} />
      ))}
    </div>
  );
}

/* ─── Player controls ────────────────────────────────────────── */
type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

function PlayerControls({
  state, onToggle, volume, onVolume, muted, onMute,
}: {
  state: PlayerState;
  onToggle: () => void;
  volume: number;
  onVolume: (v: number) => void;
  muted: boolean;
  onMute: () => void;
}) {
  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';

  return (
    <div className="w-full bg-[#0d0e11] rounded-2xl border border-white/[.06] px-5 py-4">
      <div className="flex items-center gap-4">

        {/* Play / Pause / Loading */}
        <button
          onClick={onToggle}
          disabled={state === 'error'}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-30"
          style={{ background: isPlaying ? '#ef4444' : 'rgba(255,255,255,.12)' }}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isPlaying ? (
            /* Pause icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            /* Play icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        {/* Status text */}
        <div className="flex-1 min-w-0">
          {state === 'error' ? (
            <p className="text-xs text-red-400 font-medium">Sin conexión con el stream</p>
          ) : isLoading ? (
            <p className="text-xs text-white/40 animate-pulse">Conectando al stream...</p>
          ) : isPlaying ? (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <p className="text-xs text-white/60 font-medium uppercase tracking-[.15em]">En vivo</p>
            </div>
          ) : (
            <p className="text-xs text-white/30">Toca para escuchar</p>
          )}
          <p className="text-[10px] text-white/15 font-mono mt-0.5 truncate">{STREAM_URL}</p>
        </div>

        {/* Volume */}
        <button onClick={onMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          className="text-white/30 hover:text-white transition-colors flex-shrink-0">
          {muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}
        </button>
        <input
          type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
          onChange={e => onVolume(Number(e.target.value))}
          className="w-20 h-1 accent-red-500 flex-shrink-0"
          aria-label="Volumen"
        />
      </div>
    </div>
  );
}

/* ─── DJ Card ────────────────────────────────────────────────── */
function DJCard({ username, profile }: { username: string; profile: string }) {
  return (
    <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/[.06] bg-white/[.03]">
      {profile
        ? <img src={profile} alt={username} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10" />
        : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><Radio size={16} className="text-white/40" /></div>
      }
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-red-400 font-bold uppercase tracking-[.25em] leading-none mb-0.5">DJ en vivo</p>
        <p className="text-sm font-semibold text-white truncate">{username}</p>
      </div>
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
    </motion.div>
  );
}

/* ─── History ────────────────────────────────────────────────── */
function HistoryList({ tracks }: { tracks: string[] }) {
  const [open, setOpen] = useState(false);
  if (!tracks?.length) return null;
  return (
    <div className="w-full">
      <button onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 text-white/25 hover:text-white/50 transition-colors text-[10px] uppercase tracking-[.25em] font-bold w-full justify-center py-1">
        <History size={11} /> {open ? 'Ocultar historial' : 'Últimas canciones'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} className="overflow-hidden mt-2">
            <div className="w-full rounded-2xl border border-white/[.06] bg-white/[.02] overflow-hidden">
              {tracks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[.04] last:border-0">
                  <span className="text-white/15 text-[10px] font-mono w-4 flex-shrink-0">{i + 1}</span>
                  <span className="text-white/50 text-xs truncate">{t}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Social icons ───────────────────────────────────────────── */
function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}
function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function UserApp() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [config, setConfig]           = useState<AppConfig | null>(null);
  const [showSplash, setShowSplash]   = useState(false);
  const [countdown, setCountdown]     = useState(0);
  const [radioInfo, setRadioInfo]     = useState<RadioInfo | null>(null);
  const [isLoading, setIsLoading]     = useState(true);

  // Player state
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [volume, setVolume]           = useState(1);
  const [muted, setMuted]             = useState(false);

  /* ── Audio event handlers ── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onWaiting  = () => setPlayerState('loading');
    const onPlaying  = () => setPlayerState('playing');
    const onPause    = () => setPlayerState('idle');
    const onError    = () => setPlayerState('error');
    const onStalled  = () => setPlayerState('loading');

    audio.addEventListener('waiting',  onWaiting);
    audio.addEventListener('playing',  onPlaying);
    audio.addEventListener('pause',    onPause);
    audio.addEventListener('error',    onError);
    audio.addEventListener('stalled',  onStalled);

    return () => {
      audio.removeEventListener('waiting',  onWaiting);
      audio.removeEventListener('playing',  onPlaying);
      audio.removeEventListener('pause',    onPause);
      audio.removeEventListener('error',    onError);
      audio.removeEventListener('stalled',  onStalled);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playerState === 'playing' || playerState === 'loading') {
      audio.pause();
      // Force reload so next play fetches fresh stream
      audio.load();
      setPlayerState('idle');
    } else {
      setPlayerState('loading');
      audio.src = STREAM_URL;
      audio.load();
      audio.play().catch(() => setPlayerState('error'));
    }
  }, [playerState]);

  const handleVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    if (v > 0) setMuted(false);
  };

  const handleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  };

  /* ── Radio info polling (10s) ── */
  useEffect(() => {
    const poll = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/radio-info');
        if (res.ok) setRadioInfo(await res.json());
      } catch { /* silent */ }
      finally { setIsLoading(false); }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, []);

  /* ── Firebase config ── */
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'main'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as AppConfig;
        setConfig(data);
        if (data.splashAd.enabled) { setShowSplash(true); setCountdown(data.splashAd.duration); }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'config/main')
    );
    return () => unsub();
  }, []);

  /* ── Splash countdown ── */
  useEffect(() => {
    if (!showSplash || countdown <= 0) return;
    const t = setInterval(() => setCountdown(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [showSplash, countdown]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title:'JCMC Radio', text:'¡Escucha JCMC Radio en vivo!', url:window.location.origin }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.origin);
    }
  };

  const artSrc  = radioInfo?.art || 'https://picsum.photos/seed/radio/600/600';
  const hasDJ   = Boolean(radioInfo?.djusername);
  const isActive = playerState === 'playing';

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/30 text-[10px] uppercase tracking-[.4em]">Cargando</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060608] flex flex-col items-center relative overflow-hidden text-white">

      {/* Hidden audio element */}
      <audio ref={audioRef} preload="none" />

      {/* Ambient background */}
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {radioInfo?.art && (
          <img src={artSrc}
            className="absolute inset-0 w-full h-full object-cover opacity-[.07] blur-[90px] scale-110 pointer-events-none" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060608]/80 via-[#060608]/50 to-[#060608]" />
      </div>

      {/* Sticky banner */}
      {config.stickyBanner?.imageUrl && (
        <a href={config.stickyBanner.link || '#'} target="_blank" rel="noopener noreferrer"
          className="relative z-20 w-full max-w-sm">
          <img src={config.stickyBanner.imageUrl} alt="Banner"
            className="w-full object-cover" style={{ maxHeight:60 }} referrerPolicy="no-referrer" />
        </a>
      )}

      {/* Splash Ad */}
      <AnimatePresence>
        {showSplash && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-8">
            <motion.img initial={{ scale:.92, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ delay:.15 }}
              src={config.splashAd.imageUrl} alt="Publicidad"
              className="max-w-xs w-full rounded-3xl shadow-2xl shadow-black" referrerPolicy="no-referrer" />
            <div className="mt-12 flex flex-col items-center gap-3">
              {countdown > 0 ? (
                <>
                  <span className="text-4xl font-mono font-light text-white/60 tabular-nums">{countdown}</span>
                  <span className="text-[9px] text-white/20 uppercase tracking-[.45em] animate-pulse">Conectando...</span>
                </>
              ) : (
                <motion.button initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  onClick={() => setShowSplash(false)}
                  className="px-12 py-3.5 bg-white text-black text-sm font-black rounded-full uppercase tracking-[.15em] hover:bg-white/90 active:scale-95 transition-all">
                  Entrar
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup alert */}
      {config.popupAlert?.enabled && (
        <div className="fixed bottom-24 left-4 right-4 z-50 max-w-sm mx-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-4 shadow-2xl">
            <p className="text-sm font-bold text-white">{config.popupAlert.title}</p>
            <p className="text-xs text-white/50 mt-1">{config.popupAlert.message}</p>
          </div>
        </div>
      )}

      {/* Main layout */}
      <main className="relative z-10 w-full max-w-sm flex flex-col items-center px-5 min-h-screen">

        {/* Header */}
        <header className="pt-safe w-full flex items-center justify-between pt-5 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-[.3em]">En Vivo</span>
          </div>
          <span className="text-[13px] font-black uppercase tracking-[.2em] text-white/80">JCMC Radio</span>
          <button onClick={handleShare} aria-label="Compartir"
            className="p-2 text-white/25 hover:text-white transition-colors active:scale-90">
            <Share2 size={16}/>
          </button>
        </header>

        {/* DJ Card */}
        <AnimatePresence>
          {hasDJ && (
            <div className="w-full mt-3 mb-1">
              <DJCard username={radioInfo!.djusername} profile={radioInfo!.djprofile} />
            </div>
          )}
        </AnimatePresence>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center w-full gap-6 py-4">

          {/* Album art — clicking it also toggles play */}
          <div className="relative cursor-pointer" onClick={togglePlay} role="button" aria-label={isActive ? 'Pausar' : 'Reproducir'}>
            <div className="absolute -inset-4 rounded-[40px] opacity-20 blur-2xl pointer-events-none"
              style={{ background:'radial-gradient(circle, #ef4444 0%, transparent 70%)' }} />
            <motion.div
              animate={{ y: isActive ? [0,-7,0] : 0 }}
              transition={{ duration:5, repeat: isActive ? Infinity : 0, ease:'easeInOut' }}
              className="relative w-52 h-52 rounded-[28px] overflow-hidden ring-1 ring-white/10"
              style={{ boxShadow:'0 28px 56px rgba(0,0,0,.75)' }}
            >
              <img src={artSrc} alt="Portada" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/[.08] via-transparent to-black/30 pointer-events-none" />

              {/* Tap-to-play overlay hint when idle */}
              {playerState === 'idle' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[28px]">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Waveform — synced to actual playback */}
          <AudioWaveform active={isActive} />

          {/* Track info */}
          <div className="flex flex-col items-center gap-2 text-center px-2 w-full">
            <h2 className="text-[17px] font-bold text-white leading-snug tracking-tight line-clamp-2">
              {isLoading ? '—' : (radioInfo?.title || 'Transmisión en vivo')}
            </h2>
            <div className="flex items-center gap-2 text-white/35 text-xs flex-wrap justify-center">
              {radioInfo?.listeners != null && (
                <span className="flex items-center gap-1">
                  <Users size={10}/>
                  {radioInfo.listeners.toLocaleString()} oyentes
                </span>
              )}
              {radioInfo?.bitrate && (
                <>
                  <span className="text-white/15">·</span>
                  <span className="text-white/20 text-[10px] font-mono">{radioInfo.bitrate} kbps</span>
                </>
              )}
            </div>
          </div>

          {/* Song history */}
          {radioInfo?.history?.length > 0 && <HistoryList tracks={radioInfo.history} />}
        </div>

        {/* Native player controls */}
        <div className="w-full mb-5">
          <PlayerControls
            state={playerState}
            onToggle={togglePlay}
            volume={volume}
            onVolume={handleVolume}
            muted={muted}
            onMute={handleMute}
          />
        </div>

        {/* Quick links */}
        {config.quickLinks?.length > 0 && (
          <div className="w-full grid grid-cols-2 gap-2 mb-5">
            {config.quickLinks.slice(0, 6).map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="py-2.5 px-3 bg-white/[.03] hover:bg-white/[.07] border border-white/[.05] rounded-xl text-center text-[11px] font-medium text-white/55 hover:text-white transition-all active:scale-95 truncate">
                {link.label}
              </a>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="pb-safe w-full flex flex-col items-center gap-5 pb-8">
          <div className="flex items-center gap-7">
            {config.socialLinks?.instagram && (
              <a href={config.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                className="text-white/25 hover:text-white transition-colors active:scale-90"><Instagram size={20}/></a>
            )}
            {config.socialLinks?.facebook && (
              <a href={config.socialLinks.facebook} target="_blank" rel="noopener noreferrer"
                className="text-white/25 hover:text-white transition-colors active:scale-90"><Facebook size={20}/></a>
            )}
            {config.socialLinks?.tiktok && (
              <a href={config.socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
                className="text-white/25 hover:text-white transition-colors active:scale-90"><TikTokIcon/></a>
            )}
            {config.socialLinks?.whatsapp && (
              <a href={`https://wa.me/${config.socialLinks.whatsapp}`} target="_blank" rel="noopener noreferrer"
                className="text-white/25 hover:text-green-400 transition-colors active:scale-90"><WhatsAppIcon/></a>
            )}
          </div>
          <a href="/admin" className="text-[9px] text-white/10 hover:text-white/25 uppercase tracking-[.35em] transition-colors">
            Panel Admin
          </a>
        </footer>
      </main>
    </div>
  );
}
