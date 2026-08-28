import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Superettan Slutspurten', description: 'Simulera slutet av Superettan och se tabellen förändras direkt.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv"><body>{children}</body></html>;
}
