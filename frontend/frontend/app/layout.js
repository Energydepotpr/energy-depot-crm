import './globals.css';
import { AuthProvider } from '../lib/auth';
import { LangProvider } from '../lib/lang-context';
import PWARegister from './components/PWARegister';

export const metadata = {
  title: 'Fix A Trip PR — CRM',
  description: 'CRM interno Fix A Trip Puerto Rico',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FAT CRM',
  },
  icons: {
    icon: '/logo.webp',
    apple: '/logo.webp',
    shortcut: '/logo.webp',
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
        <meta name="apple-mobile-web-app-title" content="FAT CRM" />
        <link rel="apple-touch-icon" href="/logo.webp" />
        <link rel="apple-touch-startup-image" href="/logo.webp" />
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
