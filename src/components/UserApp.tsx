import React, { useCallback, useEffect, useRef, useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { AppConfig } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import {
  Facebook,
  History,
  Instagram,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Share2,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';

const STREAM_URL = 'https://sp.aljania.com/8120/stream';

type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

interface RadioInfo {
  title: string;
  art: string;
  listeners: number;
  ulistener: number;
  bitrate: number;
  djusername: string;
  djprofile: string;
  history: string[];
}

const fallbackConfig = {
  socialLinks: {
    instagram: '',
    facebook: '',
    tiktok: '',
    whatsapp: '',
  },
  splashAd: {
    enabled: false,
    duration: 0,
    imageUrl: '',
  },
} as AppConfig;

function TikTokIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

export default function UserApp() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [config, setConfig] = useState<AppConfig>(fallbackConfig);
  const [showSplash, setShowSplash] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [radioInfo, setRadioInfo] = useState<RadioInfo | null>(null);
  const [albumArt, setAlbumArt] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadRadioInfo = useCallback(async () => {
    try {
      setInfoLoading(true);
      const response = await fetch('/api/radio-info', { cache: 'no-store' });
      if (!response.ok) throw new Error('radio-info unavailable');
      const data = (await response.json()) as RadioInfo;
      setRadioInfo(data);
    } catch {
      // The live stream remains usable even when metadata is temporarily unavailable.
    } finally {
      setInfoLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRadioInfo();
    const interval = window.setInterval(loadRadioInfo, 15000);
    return () => window.clearInterval(interval);
  }, [loadRadioInfo]);

  useEffect(() => {
    if (!radioInfo?.title) {
      setAlbumArt(null);
      return;
    }

    const controller = new AbortController();
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(radioInfo.title)}&media=music&entity=song&limit=1`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const art = data?.results?.[0]?.artworkUrl100;
        setAlbumArt(art ? art.replace('100x100bb.jpg', '600x600bb.jpg') : null);
      })
      .catch(() => setAlbumArt(null));

    return () => controller.abort();
  }, [radioInfo?.title]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'config', 'main'),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as AppConfig;
        setConfig(data);
        if (data.splashAd?.enabled && data.splashAd.imageUrl) {
          setShowSplash(true);
          setCountdown(Math.max(0, data.splashAd.duration || 0));
        }
      },
      (error) => {
        // Configuration is optional for the core radio experience.
        handleFirestoreError(error, OperationType.GET, 'config/main');
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!showSplash || countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [showSplash, countdown]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onWaiting = () => setPlayerState('loading');
    const onPlaying = () => setPlayerState('playing');
    const onPause = () => setPlayerState('idle');
    const onError = () => setPlayerState('error');

    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playerState === 'playing' || playerState === 'loading') {
      audio.pause();
      return;
    }

    try {
      setPlayerState('loading');
      audio.src = STREAM_URL;
      audio.load();
      await audio.play();
    } catch {
      setPlayerState('error');
    }
  }, [playerState]);

  const retryStream = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      setPlayerState('loading');
      audio.pause();
      audio.src = `${STREAM_URL}?t=${Date.now()}`;
      audio.load();
      await audio.play();
    } catch {
      setPlayerState('error');
    }
  }, []);

  const handleVolume = (next: number) => {
    setVolume(next);
    setMuted(next === 0);
    if (audioRef.current) {
      audioRef.current.volume = next;
      audioRef.current.muted = next === 0;
    }
  };

  const handleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  };

  const handleShare = async () => {
    const payload = {
      title: 'JCM Radio - Rock',
      text: 'Escuchá JCM Radio - Rock en vivo.',
      url: window.location.origin,
    };
    try {
      if (navigator.share) await navigator.share(payload);
      else await navigator.clipboard.writeText(window.location.origin);
    } catch {
      // User cancelled share or clipboard is unavailable.
    }
  };

  const openWhatsApp = () => {
    const number = config.socialLinks?.whatsapp?.replace(/\D/g, '');
    if (number) window.open(`https://wa.me/${number}`, '_blank', 'noopener,noreferrer');
  };

  const isPlaying = playerState === 'playing';
  const cover = albumArt || radioInfo?.art || '';
  const history = radioInfo?.history?.filter(Boolean).slice(0, 8) || [];

  return (
    <div className="min-h-screen bg-[#050506] text-white relative overflow-x-hidden">
      <audio ref={audioRef} preload="none" playsInline />

      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(185,28,28,.18),transparent_38%),linear-gradient(to_bottom,#0b0b0d,#050506_55%)]" />

      <AnimatePresence>
        {showSplash && config.splashAd?.imageUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
            <img src={config.splashAd.imageUrl} alt="JCM Radio" className="max-w-full max-h-[65vh] object-contain rounded-3xl" />
            <div className="mt-8">
              {countdown > 0 ? (
                <p className="text-white/60 text-sm">Ingresando en {countdown}…</p>
              ) : (
                <button onClick={() => setShowSplash(false)} className="rounded-full bg-white text-black px-8 py-3 font-bold">Entrar a JCM Radio</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative z-10 max-w-xl mx-auto px-5 pt-safe pt-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[.28em] text-red-400 font-bold">Rock on line</p>
          <h1 className="text-xl font-black tracking-tight">JCM RADIO</h1>
        </div>
        <button onClick={handleShare} aria-label="Compartir JCM Radio" className="w-11 h-11 rounded-full border border-white/10 bg-white/[.04] flex items-center justify-center active:scale-95">
          <Share2 size={18} />
        </button>
      </header>

      <main className="relative z-10 max-w-xl mx-auto px-5 pb-safe pb-10 pt-6 space-y-5">
        <section className="rounded-[30px] border border-white/10 bg-[#0e0e11]/95 overflow-hidden shadow-2xl">
          <div className="relative aspect-square max-h-[430px] bg-gradient-to-br from-red-950/40 to-black flex items-center justify-center overflow-hidden">
            {cover ? (
              <img src={cover} alt={radioInfo?.title || 'JCM Radio'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-center">
                <Radio size={74} className="mx-auto text-red-500 mb-4" />
                <p className="text-3xl font-black">JCM RADIO</p>
                <p className="text-sm tracking-[.3em] text-white/40 mt-2">ROCK</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/10" />
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/65 backdrop-blur px-3 py-2 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-[.22em] font-bold">En vivo</span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="text-center min-h-[58px]">
              <p className="text-xs uppercase tracking-[.22em] text-red-400 font-bold mb-2">Ahora suena</p>
              <h2 className="text-lg sm:text-xl font-bold leading-snug break-words">
                {infoLoading && !radioInfo ? 'Actualizando información…' : radioInfo?.title || 'JCM Radio - transmisión en vivo'}
              </h2>
              {radioInfo?.djusername && <p className="text-xs text-white/45 mt-1">DJ: {radioInfo.djusername}</p>}
            </div>

            <div className="flex items-center justify-center">
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pausar radio' : 'Reproducir radio'}
                className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,.28)] active:scale-95 disabled:opacity-50"
                disabled={playerState === 'loading'}
              >
                {playerState === 'loading' ? (
                  <RefreshCw size={28} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={30} fill="currentColor" />
                ) : (
                  <Play size={31} fill="currentColor" className="ml-1" />
                )}
              </button>
            </div>

            {playerState === 'error' && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                <p className="text-sm text-red-200">No pudimos conectar con la transmisión.</p>
                <button onClick={retryStream} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-white">
                  <RefreshCw size={15} /> Reintentar
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 rounded-2xl bg-white/[.035] border border-white/[.06] px-4 py-3">
              <button onClick={handleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'} className="text-white/65">
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input aria-label="Volumen" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(e) => handleVolume(Number(e.target.value))} className="w-full accent-red-600" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[.035] border border-white/[.06] p-4">
                <Users size={18} className="text-red-400 mb-2" />
                <p className="text-xl font-bold">{radioInfo?.listeners ?? '—'}</p>
                <p className="text-[11px] text-white/40">Oyentes ahora</p>
              </div>
              <button onClick={loadRadioInfo} className="text-left rounded-2xl bg-white/[.035] border border-white/[.06] p-4 active:scale-[.98]">
                <RefreshCw size={18} className="text-red-400 mb-2" />
                <p className="text-sm font-bold">Actualizar</p>
                <p className="text-[11px] text-white/40">Canción y estado</p>
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0e0e11]/90 overflow-hidden">
          <button onClick={() => setHistoryOpen((open) => !open)} className="w-full px-5 py-4 flex items-center justify-between text-left">
            <span className="flex items-center gap-3 font-bold"><History size={18} className="text-red-400" /> Últimas canciones</span>
            <span className="text-xs text-white/40">{historyOpen ? 'Ocultar' : 'Ver historial'}</span>
          </button>
          <AnimatePresence initial={false}>
            {historyOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-5 pb-5 space-y-2">
                  {history.length ? history.map((track, index) => (
                    <div key={`${track}-${index}`} className="flex gap-3 py-2 border-t border-white/[.06]">
                      <span className="text-xs text-white/25 w-5">{index + 1}</span>
                      <span className="text-sm text-white/70">{track}</span>
                    </div>
                  )) : <p className="text-sm text-white/40 py-2">El historial aparecerá cuando el servidor lo informe.</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0e0e11]/90 p-5">
          <h3 className="font-bold text-lg">JCM Radio - Rock</h3>
          <p className="text-sm text-white/55 leading-relaxed mt-2">
            Radio online de rock con transmisión en vivo. Escuchá la programación desde el teléfono, consultá qué está sonando y compartí la radio con tus contactos.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0e0e11]/90 p-5">
          <h3 className="font-bold mb-4">Seguinos y contactanos</h3>
          <div className="flex flex-wrap gap-3">
            {config.socialLinks?.instagram && <a href={config.socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="social-button"><Instagram size={21} /></a>}
            {config.socialLinks?.facebook && <a href={config.socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="social-button"><Facebook size={21} /></a>}
            {config.socialLinks?.tiktok && <a href={config.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="social-button"><TikTokIcon /></a>}
            {config.socialLinks?.whatsapp && <button onClick={openWhatsApp} className="rounded-full border border-white/10 bg-white/[.05] px-4 h-11 text-sm font-bold">WhatsApp</button>}
            {!config.socialLinks?.instagram && !config.socialLinks?.facebook && !config.socialLinks?.tiktok && !config.socialLinks?.whatsapp && <p className="text-sm text-white/40">Escuchá JCM Radio y compartila desde el botón superior.</p>}
          </div>
        </section>

        <p className="text-center text-[11px] text-white/25 pt-2">JCM Radio · Streaming en vivo</p>
      </main>
    </div>
  );
}
