import { useEffect, useState } from 'react';
import { Megaphone, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, type Sponsor } from '@/lib/supabase';

export function SponsorCarousel() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    supabase
      .from('sponsors')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        setSponsors((data as Sponsor[]) ?? []);
      });
  }, []);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % sponsors.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  if (sponsors.length === 0) return null;

  const go = (dir: 1 | -1) => {
    setCurrent((prev) => (prev + dir + sponsors.length) % sponsors.length);
  };

  return (
    <section className="relative mx-auto w-full max-w-5xl px-4">
      <div className="mb-3 flex items-center gap-2">
        <Megaphone size={15} className="text-gold-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Patrocinado por:
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ width: `${sponsors.length * 100}%`, transform: `translateX(-${(current * 100) / sponsors.length}%)` }}
        >
          {sponsors.map((s) => (
            <div key={s.id} className="shrink-0 px-1" style={{ width: `${100 / sponsors.length}%` }}>
              <div className="relative">
                <a
                  href={s.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="relative flex min-h-[170px] w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 sm:min-h-[230px]">
                    <img
                      src={s.image_url}
                      alt={s.title}
                      className="block h-auto max-h-[420px] w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020819]/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        {s.title && (
                          <p className="font-display text-sm font-bold text-white drop-shadow-lg sm:text-base">
                            {s.title}
                          </p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-4 py-2 text-xs font-bold text-navy-950 shadow-lg transition-transform group-hover:scale-105 sm:text-sm">
                        <ExternalLink size={14} />
                        {s.button_label || 'Visitar'}
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          ))}
        </div>

        {sponsors.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-[#020819]/60 p-2 text-white/80 backdrop-blur-sm transition hover:bg-[#020819]/90 hover:text-white"
              aria-label="Anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-[#020819]/60 p-2 text-white/80 backdrop-blur-sm transition hover:bg-[#020819]/90 hover:text-white"
              aria-label="Siguiente"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {sponsors.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrent(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === current ? 'w-6 bg-gold-400' : 'w-1.5 bg-white/30'
                  }`}
                  aria-label={`Ir al banner ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
