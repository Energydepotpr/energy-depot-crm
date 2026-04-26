'use client';
import Image from 'next/image';

/**
 * Energy Depot PR — Logo
 *
 * Variants:
 *   - icon: just the plug emblem (transparent bg, fits anywhere)
 *   - full: full logo with text (only works on dark backgrounds since the text is white)
 *   - card: full logo wrapped in a dark navy card (works on light bg)
 */
export default function Logo({ variant = 'icon', size = 40, className, style }) {

  if (variant === 'icon') {
    return (
      <div className={className} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:size, height:size, ...style }}>
        <Image src="/logo-icon.png" alt="Energy Depot" width={size} height={size}
          style={{ width:size, height:size, objectFit:'contain' }} priority/>
      </div>
    );
  }

  if (variant === 'card') {
    // Full logo on a dark navy card — for light backgrounds
    const w = size * 4; // logo aspect ratio is ~4:1
    return (
      <div className={className} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'10px 18px', background:'linear-gradient(135deg,#0f2558 0%,#1a3c8f 100%)', borderRadius:10, ...style }}>
        <Image src="/logo-dark.png" alt="Energy Depot" width={w} height={size}
          style={{ width:'auto', height:size, objectFit:'contain' }} priority/>
      </div>
    );
  }

  // full — use only on dark backgrounds
  const w = size * 4;
  return (
    <div className={className} style={{ display:'inline-flex', alignItems:'center', ...style }}>
      <Image src="/logo-dark.png" alt="Energy Depot" width={w} height={size}
        style={{ width:'auto', height:size, objectFit:'contain' }} priority/>
    </div>
  );
}
