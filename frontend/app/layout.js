import './globals.css';
import { AuthProvider } from '../lib/auth';
import { LangProvider } from '../lib/lang-context';
import PWARegister from './components/PWARegister';

export const metadata = {
  title: 'Energy Depot PR — CRM Solar',
  description: 'CRM interno Energy Depot PR',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ED CRM',
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=4', sizes: 'any' },
      { url: '/logo-icon.png?v=4', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png?v=4', sizes: '180x180' },
    ],
    shortcut: '/favicon.ico?v=4',
  },
};

export const viewport = {
  themeColor: '#1a1f38',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* PWA / iOS */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ED CRM" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png?v=4" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=4" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png?v=4" />
        <link rel="apple-touch-startup-image" href="/apple-icon.png?v=4" />
        <meta name="theme-color" content="#1b9af5" />
        {/* Prevent zoom on inputs (iOS) */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        {/* Apply theme BEFORE React hydrates to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var s = localStorage.getItem('crm_theme');
            if ((s || 'light') === 'light') {
              document.documentElement.setAttribute('data-theme', 'light');
            }
          } catch(e) {}
        ` }} />
      </head>
      <body>
        <AuthProvider><LangProvider>{children}</LangProvider></AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}
