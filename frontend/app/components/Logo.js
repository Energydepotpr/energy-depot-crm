'use client';

/**
 * Energy Depot PR — Logo SVG component
 * Clean recreation of the brand mark for use across the CRM
 *
 * Variants:
 *   - icon: just the plug emblem (square, perfect for sidebar/avatar)
 *   - horizontal: plug emblem + text side by side
 *   - stacked: plug emblem on top, text below (for loading screens)
 */
export default function Logo({ variant = 'icon', size = 40, theme = 'auto', className, style }) {
  // theme: 'dark' = navy text (for light bg); 'light' = white text (for dark bg); 'auto' = adapts via CSS var
  const textColor = theme === 'dark' ? '#1a3c8f' : theme === 'light' ? '#ffffff' : 'var(--text)';

  // SVG plug emblem — recreated cleanly from the brand
  const PlugMark = ({ s = size, gradient = true }) => (
    <svg width={s} height={s} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {gradient && (
        <defs>
          <linearGradient id="edGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6"/>
            <stop offset="100%" stopColor="#1a3c8f"/>
          </linearGradient>
        </defs>
      )}
      {/* Outer circle */}
      <circle cx="50" cy="50" r="42" stroke={gradient ? 'url(#edGrad)' : '#1a3c8f'} strokeWidth="5" fill="none"/>
      {/* Plug body — triangle pointing down */}
      <path d="M50 28 L62 50 L50 56 L38 50 Z" fill={gradient ? 'url(#edGrad)' : '#1a3c8f'}/>
      {/* Two prongs sticking up */}
      <rect x="44" y="20" width="3.5" height="10" fill={gradient ? 'url(#edGrad)' : '#1a3c8f'} rx="1"/>
      <rect x="52.5" y="20" width="3.5" height="10" fill={gradient ? 'url(#edGrad)' : '#1a3c8f'} rx="1"/>
      {/* Lightning bolt inside the plug body */}
      <path d="M51 36 L46 46 L50 46 L48 52 L54 42 L50 42 L52 36 Z" fill="#ffffff"/>
      {/* Cord curling out the bottom */}
      <path d="M50 56 Q50 72, 65 75 Q78 78, 78 88" stroke={gradient ? 'url(#edGrad)' : '#1a3c8f'} strokeWidth="4" fill="none" strokeLinecap="round"/>
    </svg>
  );

  if (variant === 'icon') {
    return <div className={className} style={style}><PlugMark s={size}/></div>;
  }

  if (variant === 'stacked') {
    return (
      <div className={className} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, ...style }}>
        <PlugMark s={size}/>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize: size*0.32, fontWeight:900, letterSpacing:'2.5px', color: textColor, lineHeight:1 }}>ENERGY DEPOT</div>
          <div style={{ fontSize: size*0.13, fontWeight:600, letterSpacing:'1.5px', color: textColor, opacity:0.7, marginTop:6 }}>WE ARE THE DIFFERENCE</div>
        </div>
      </div>
    );
  }

  // horizontal
  return (
    <div className={className} style={{ display:'flex', alignItems:'center', gap:size*0.25, ...style }}>
      <PlugMark s={size}/>
      <div style={{ display:'flex', flexDirection:'column', lineHeight:1 }}>
        <div style={{ fontSize: size*0.42, fontWeight:900, letterSpacing:'1.2px', color: textColor }}>ENERGY DEPOT</div>
        <div style={{ fontSize: size*0.16, fontWeight:600, letterSpacing:'1.2px', color: textColor, opacity:0.7, marginTop:3 }}>WE ARE THE DIFFERENCE</div>
      </div>
    </div>
  );
}
