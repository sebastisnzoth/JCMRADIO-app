import React, { useState, useEffect, useRef } from 'react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { AppConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Instagram, Facebook, Play, Pause } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function UserApp() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [radioInfo, setRadioInfo] = useState<RadioInfo | null>(null);
  const [albumArt, setAlbumArt] = useState<string | null>(null);
  const [isLoadingRadio, setIsLoadingRadio] = useState(true);
  const [errorRadio, setErrorRadio] = useState<string | null>(null);

  useEffect(() => {
    const fetchRadioInfo = async () => {
      try {
        setIsLoadingRadio(true);
        const response = await fetch('/api/radio-info');
        if (!response.ok) throw new Error('Radio server offline');
        const data = await response.json();
        setRadioInfo(data);
        setErrorRadio(null);
      } catch (error) {
        console.error('Error fetching radio info:', error);
        setErrorRadio(error instanceof Error ? error.message : 'No disponible');
      } finally {
        setIsLoadingRadio(false);
      }
    };

    fetchRadioInfo();
    const interval = setInterval(fetchRadioInfo, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (radioInfo?.title) {
      // Search for album art using iTunes API
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(radioInfo.title)}&media=music&entity=song&limit=1`)
        .then(res => res.json())
        .then(data => {
          if (data.results && data.results.length > 0) {
            // Use higher resolution artwork
            setAlbumArt(data.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg'));
          } else {
            setAlbumArt(null);
          }
        })
        .catch(err => console.error('Error searching album art:', err));
    }
  }, [radioInfo?.title]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppConfig;
        setConfig(data);
        
        // Handle Splash Ad
        if (data.splashAd.enabled) {
          setShowSplash(true);
          setCountdown(data.splashAd.duration);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/main');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (showSplash && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [showSplash, countdown]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'JCM Radio',
        text: 'Escucha JCM Radio en vivo!',
        url: window.location.origin,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.origin);
      alert('Enlace copiado al portapapeles');
    }
  };

  const openWhatsApp = () => {
    if (!config?.socialLinks.whatsapp) return;
    const url = `https://wa.me/${config.socialLinks.whatsapp}`;
    window.open(url, '_blank');
  };

  if (!config) return <div className="min-h-screen flex items-center justify-center bg-black">Cargando...</div>;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center relative overflow-hidden font-sans text-white">
      {/* Immersive Atmospheric Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div 
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#1a1a1a_0%,#050505_70%)]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[20%] w-[70%] h-[70%] rounded-full bg-blue-900/20 blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute -bottom-[20%] -right-[20%] w-[70%] h-[70%] rounded-full bg-purple-900/20 blur-[120px]"
        />
      </div>

      {/* Splash Ad */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center p-6"
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={config.splashAd.imageUrl}
              alt="Splash Ad"
              className="max-w-full max-h-[60vh] object-contain rounded-3xl shadow-2xl shadow-blue-500/10"
              referrerPolicy="no-referrer"
            />
            <div className="mt-12 flex flex-col items-center gap-8">
              {countdown > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="text-4xl font-light font-mono text-white/80 tracking-widest">
                    {countdown}
                  </div>
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">
                    Conectando...
                  </p>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSplash(false)}
                  className="px-12 py-4 bg-white text-black rounded-full font-bold text-sm uppercase tracking-[0.2em] shadow-lg transition-all hover:bg-white/90"
                >
                  Entrar
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md md:max-w-lg lg:max-w-xl flex flex-col items-center justify-center p-6 md:p-8 gap-8 md:gap-10 z-10">
        
        {/* Technical Hardware Player Card */}
        <motion.div 
          whileHover={{ boxShadow: "0 0 40px -10px rgba(59, 130, 246, 0.3)" }}
          className="w-full bg-[#0d0e11] rounded-3xl p-6 md:p-8 border border-[#2A2B2E] shadow-2xl flex flex-col items-center gap-8 relative overflow-hidden transition-all duration-500"
        >
          {/* Dynamic Background Glow */}
          <div className="absolute inset-x-0 top-0 h-[200px] bg-blue-500/5 blur-[100px] -z-10" />
          
          {/* Subtle Glow Overlay */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          
          {/* Album Art with Hardware Housing */}
          <div className="relative group p-1 border border-[#2A2B2E] rounded-3xl bg-[#08090b]/50 shadow-inner">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="w-56 h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-black/80 relative transition-transform duration-500"
            >
              <img
                src={albumArt || radioInfo?.art || "https://picsum.photos/seed/radio/800/800"}
                alt="Cover"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent" />
            </motion.div>

            {/* Live Indicator Widget */}
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#2a2b2e]/60">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#8E9299]">En Vivo</span>
            </div>
          </div>

          {/* Player Controls & Info */}
          <div className="flex flex-col items-center gap-4 w-full">
            <h2 className="text-2xl font-bold tracking-tight text-white font-sans uppercase tracking-[0.05em] mb-1">
              JCM Radio
            </h2>
            <p className="text-sm font-medium text-[#6E7279] tracking-tighter truncate px-4 font-mono">
              {radioInfo?.title || "Transmisión en vivo"}
            </p>


          </div>

          {/* Technical Player Iframe Wrapper */}
          <div className="w-[410px] h-[150px] border-t border-[#2A2B2E] pt-8 space-y-6">
            <motion.div 
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full rounded-xl overflow-hidden border border-[#2A2B2E] shadow-lg shadow-black/40"
            >
              <iframe 
                src="https://sp.aljania.com/cp/widgets/player/single/?p=8120" 
                className="w-[407px] h-[115px]"
                scrolling="no" 
                style={{ border: 'none' }}
                title="SonicPanel Player"
              />
            </motion.div>
          </div>
        </motion.div>

        </main>

      {/* Footer */}
      <footer className="w-full max-w-md md:max-w-lg lg:max-w-xl p-8 flex flex-col items-center gap-8">
        <div className="flex justify-center gap-8 text-white/40">
          <a href={config.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Instagram size={24} /></a>
          <a href={config.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Facebook size={24} /></a>
          <a href={config.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
          </a>
        </div>
        
        <div className="text-[10px] font-medium text-white/20 uppercase tracking-[0.2em] flex flex-col items-center gap-2">
          <span>Desarrollado por aljania.com</span>
          <a href="/admin" className="hover:text-white/40 transition-colors">Panel de Control</a>
        </div>
      </footer>
    </div>
  );
}
