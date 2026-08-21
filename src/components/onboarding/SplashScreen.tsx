import { useEffect, useState } from 'react';

/** Premium animated splash shown briefly on every launch.
 *  Fades itself out and calls onDone once the entrance animation completes. */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 1900);
    const t2 = window.setTimeout(onDone, 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  const title = 'Student Planner';

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0e1016] transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* floating gradient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="splash-blob absolute -left-16 top-1/4 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        <div className="splash-blob absolute -right-10 bottom-1/4 h-64 w-64 rounded-full bg-coral/25 blur-3xl" style={{ animationDelay: '0.6s' }} />
        <div className="splash-blob absolute left-1/3 top-2/3 h-40 w-40 rounded-full bg-[#12A594]/25 blur-3xl" style={{ animationDelay: '1.1s' }} />
      </div>

      <div className="relative flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent to-coral text-3xl shadow-2xl splash-logo">
          📚
        </div>

        <h1 className="flex flex-wrap justify-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title.split('').map((ch, i) => (
            <span
              key={i}
              className="splash-letter"
              style={{ animationDelay: `${0.25 + i * 0.04}s` }}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </h1>

        <p className="splash-sub mt-3 text-sm font-medium text-white/60">Made by Dikshit Bagrecha</p>
      </div>

      <style>{`
        @keyframes splashBlob {
          0%,100% { transform: translateY(0) scale(1); opacity: 0.7; }
          50% { transform: translateY(-24px) scale(1.12); opacity: 1; }
        }
        .splash-blob { animation: splashBlob 3.5s ease-in-out infinite; }

        @keyframes splashLogoIn {
          0% { transform: scale(0.4) rotate(-12deg); opacity: 0; }
          60% { transform: scale(1.12) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .splash-logo { animation: splashLogoIn 0.7s cubic-bezier(.34,1.56,.64,1) both; }

        @keyframes splashLetterIn {
          0% { transform: translateY(18px); opacity: 0; filter: blur(6px); }
          100% { transform: translateY(0); opacity: 1; filter: blur(0); }
        }
        .splash-letter { display: inline-block; animation: splashLetterIn 0.5s ease-out both; text-shadow: 0 0 24px rgba(124,134,255,0.5); }

        @keyframes splashSubIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 0.6; transform: translateY(0); }
        }
        .splash-sub { animation: splashSubIn 0.6s ease-out 1s both; }

        @media (prefers-reduced-motion: reduce) {
          .splash-blob, .splash-logo, .splash-letter, .splash-sub { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
        }
      `}</style>
    </div>
  );
}
