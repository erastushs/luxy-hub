import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://luxyhub.vercel.app'),

  title: {
    default: 'LuxyHub - Roblox Script Library',
    template: '%s | LuxyHub',
  },

  description: 'Browse supported Roblox games, track script updates, features, changelogs, and game status on LuxyHub.',

  verification: {
    google: 'ad5gzxjAMZulKRjO2s8sKoXP1jCftvwP0LRfiLY7hd4',
  },

  keywords: [
    'LuxyHub',
    'Roblox Scripts',
    'Roblox Script Library',
    'Roblox Games',
    'Game Scripts',
    'Script Hub',
    'Roblox Automation',
  ],

  authors: [
    {
      name: 'LuxyHub',
    },
  ],

  creator: 'LuxyHub',

  openGraph: {
    title: 'LuxyHub - Roblox Script Library',
    description: 'Browse supported Roblox games, track updates, features, and script status.',
    url: 'https://luxyhub.vercel.app',
    siteName: 'LuxyHub',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LuxyHub',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'LuxyHub - Roblox Script Library',
    description: 'Browse supported Roblox games, track updates, features, and script status.',
    images: ['/og-image.png'],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
