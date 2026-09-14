import type { Metadata } from 'next';
import Script from 'next/script';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site-metadata';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>
        {children}
        {process.env.NODE_ENV === 'production' && (
          <Script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id="52248e40-a565-4f89-ad1d-7b1bd62fecaf"
            data-domains="slutspurten.se"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
