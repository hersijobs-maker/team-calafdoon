import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ProtectedImage, ProtectedVideo } from '@/components/ProtectedMedia';
import { ChevronLeft, ChevronRight, ExternalLink, Megaphone } from 'lucide-react';
import type { Advertisement } from '@/lib/types';

export function AdvertisementSection() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);

  const loadAds = useCallback(async () => {
    const { data } = await supabase
      .from('advertisements')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    setAds((data as Advertisement[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Auto-rotate ads every 6 seconds
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % ads.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (loading || ads.length === 0) return null;

  const current = ads[currentIdx];

  const goPrev = () => setCurrentIdx((i) => (i === 0 ? ads.length - 1 : i - 1));
  const goNext = () => setCurrentIdx((i) => (i + 1) % ads.length);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2">
      <div className="relative rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700">
        {/* Media background */}
        <div className="relative h-64 sm:h-80 lg:h-96">
          {current.media_type === 'video' ? (
            <ProtectedVideo
              src={current.media_url}
              autoPlay
              muted
              loop
              playsInline
              controls={false}
              className="absolute inset-0 w-full h-full object-cover media-protected"
            />
          ) : (
            <ProtectedImage
              src={current.media_url}
              alt={current.title}
              className="absolute inset-0 w-full h-full object-cover media-protected"
            />
          )}

          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 lg:p-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold backdrop-blur-sm">
                <Megaphone className="w-3 h-3" />
                Advertise
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1.5 max-w-2xl leading-tight drop-shadow-lg">
              {current.title}
            </h2>
            {current.description && (
              <p className="text-sm sm:text-base text-white/90 max-w-xl leading-relaxed mb-3 drop-shadow line-clamp-2">
                {current.description}
              </p>
            )}
            {current.button_text && current.button_link && (
              <a
                href={current.button_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-emerald-700 font-bold text-sm sm:text-base px-5 py-2.5 rounded-xl shadow-lg hover:bg-emerald-50 hover:scale-105 active:scale-95 transition-all w-fit"
              >
                {current.button_text}
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Navigation arrows */}
          {ads.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors backdrop-blur-sm"
                aria-label="Previous ad"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors backdrop-blur-sm"
                aria-label="Next ad"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Dots indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {ads.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIdx(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === currentIdx ? 'w-6 bg-white' : 'w-2 bg-white/50'
                    }`}
                    aria-label={`Go to ad ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
