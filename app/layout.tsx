import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import CustomCursor from './components/CustomCursor'

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
    default: 'LuxyHub - Roblox Script Library, Updates, Features & Status',
    template: '%s | LuxyHub',
  },

  description:
    'Browse supported Roblox games, explore script features, track changelogs, monitor game status, and stay updated with the latest LuxyHub releases.',

  verification: {
    google: 'ad5gzxjAMZulKRjO2s8sKoXP1jCftvwP0LRfiLY7hd4',
  },

  keywords: [
    'LuxyHub',
    'Roblox Scripts',
    'Roblox Script Library',
    'Roblox Script Hub',
    'Roblox Features',
    'Roblox Updates',
    'Roblox Changelog',
    'Roblox Automation',
    'Game Scripts',
    'Script Library',
    'Script Hub',
  ],

  authors: [
    {
      name: 'LuxyHub',
    },
  ],

  creator: 'LuxyHub',
  applicationName: 'LuxyHub',

  openGraph: {
    title: 'LuxyHub - Roblox Script Library, Updates, Features & Status',
    description:
      'Browse supported Roblox games, explore script features, track changelogs, monitor game status, and stay updated with the latest LuxyHub releases.',
    url: 'https://luxyhub.vercel.app',
    siteName: 'LuxyHub',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: 'https://luxyhub.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LuxyHub Open Graph Image',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'LuxyHub - Roblox Script Library, Updates, Features & Status',
    description:
      'Browse supported Roblox games, explore script features, track changelogs, monitor game status, and stay updated with the latest LuxyHub releases.',
    images: ['https://luxyhub.vercel.app/og-image.png'],
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
        <CustomCursor />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
