import React from 'react';

interface RaitraLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'icon-only' | 'full' | 'stacked';
  className?: string;
  showGlow?: boolean;
  title?: string;
  subtitle?: string;
}

export const RaitraLogo: React.FC<RaitraLogoProps> = ({
  size = 'md',
  variant = 'icon-only',
  className = '',
  showGlow = false,
  title = 'Raitra Connect',
  subtitle
}) => {
  const sizeMap = {
    xs: { icon: 20, text: 'text-xs', gap: 'gap-1.5' },
    sm: { icon: 28, text: 'text-sm', gap: 'gap-2' },
    md: { icon: 34, text: 'text-base', gap: 'gap-2.5' },
    lg: { icon: 44, text: 'text-lg', gap: 'gap-3' },
    xl: { icon: 56, text: 'text-2xl', gap: 'gap-3.5' },
    '2xl': { icon: 72, text: 'text-3xl', gap: 'gap-4' }
  };

  const { icon: iconDim, text: textClass, gap: gapClass } = sizeMap[size];

  const logoIconSvg = (
    <div
      className={`relative flex items-center justify-center flex-shrink-0 select-none ${showGlow ? 'filter drop-shadow-[0_4px_12px_rgba(99,100,167,0.4)]' : ''}`}
      style={{ width: iconDim, height: iconDim }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full transform transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Main Brand Gradient */}
          <linearGradient id="raitraGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#6264a7" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>

          {/* Accent Network Flow Gradient */}
          <linearGradient id="raitraGradAccent" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>

          {/* Core Shield/Container Gradient */}
          <linearGradient id="raitraGradBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Subtle Glow Filter */}
          <filter id="raitraGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Squircle App Icon Base */}
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="24"
          fill="url(#raitraGradBg)"
          stroke="url(#raitraGradPrimary)"
          strokeWidth="2.5"
        />

        {/* Subtle Tech Grid / Background Pattern */}
        <circle cx="50" cy="50" r="32" stroke="#6264a7" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="50" cy="50" r="42" stroke="#38bdf8" strokeOpacity="0.1" strokeWidth="1" />

        {/* Stem of the R: Modern Vertical Connection Pillar */}
        <path
          d="M 28 26 L 38 26 C 40.2 26 42 27.8 42 30 L 42 70 C 42 72.2 40.2 74 38 74 L 28 74 C 25.8 74 24 72.2 24 70 L 24 30 C 24 27.8 25.8 26 28 26 Z"
          fill="url(#raitraGradPrimary)"
        />

        {/* Upper Loop of the R: Interconnected Loop */}
        <path
          d="M 38 26 C 54 26 68 33 68 46 C 68 57 56 62 42 62 L 38 62 L 38 48 L 44 48 C 50 48 54 45 54 44 C 54 39 48 37 40 37 L 38 37 Z"
          fill="url(#raitraGradAccent)"
        />

        {/* Dynamic Communication Leg of the R: Flow Wave */}
        <path
          d="M 44 54 L 58 72 C 60 74.5 63 74.5 65.5 73 C 67.8 71.5 68 68.5 66 66 L 53 50 Z"
          fill="url(#raitraGradPrimary)"
        />

        {/* Realtime Active Connection Nodes */}
        {/* Node 1: Top Signal */}
        <circle cx="68" cy="46" r="4.5" fill="#38bdf8" filter="url(#raitraGlow)" />
        <circle cx="68" cy="46" r="2" fill="#ffffff" />

        {/* Node 2: Base Anchor */}
        <circle cx="65.5" cy="73" r="4" fill="#818cf8" />
        <circle cx="65.5" cy="73" r="1.5" fill="#ffffff" />

        {/* Node 3: Center Pulse */}
        <circle cx="33" cy="50" r="3" fill="#38bdf8" />
        <circle cx="33" cy="50" r="1.2" fill="#ffffff" />
      </svg>
    </div>
  );

  if (variant === 'icon-only') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{logoIconSvg}</div>;
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center justify-center text-center gap-2 ${className}`}>
        {logoIconSvg}
        <div className="flex flex-col items-center">
          <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white ${textClass}`}>
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${gapClass} ${className}`}>
      {logoIconSvg}
      <div className="flex flex-col min-w-0">
        <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white ${textClass} leading-tight truncate`}>
          {title}
        </span>
        {subtitle && (
          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase leading-none">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
