import type { Metadata, Viewport } from 'next';
import {
  JetBrains_Mono,
  Newsreader,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import './globals.css';
import { PrivacyShieldProvider, ThemeProvider } from '@/components/ui';
import {
  CommandMenu,
  CommandPaletteProvider,
} from '@/features/command-palette';

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BudgetZen — Édition Financière Personnelle',
  description:
    'Pilotez votre reste à vivre, votre patrimoine, votre fiscalité et votre inflation personnelle avec une rigueur éditoriale.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BudgetZen',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F6F2' },
    { media: '(prefers-color-scheme: dark)', color: '#111110' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${newsreader.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('budgetzen_intro_seen')){document.documentElement.dataset.introSeen='1'}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-dvh font-sans bg-[#F7F6F2] text-[#141413] dark:bg-[#111110] dark:text-[#F2F0E8] selection:bg-[#141413] selection:text-[#F7F6F2] dark:selection:bg-[#F2F0E8] dark:selection:text-[#111110]">
        <PrivacyShieldProvider>
          <ThemeProvider>
            <CommandPaletteProvider>
              {children}
              <CommandMenu />
            </CommandPaletteProvider>
          </ThemeProvider>
        </PrivacyShieldProvider>
      </body>
    </html>
  );
}
