# LuxyHub

Ultimate Roblox Script Library built with Next.js 16, TypeScript, Tailwind CSS, and Framer Motion.

![LuxyHub Preview](public/bg.webp)

## Features

- Modern dark red UI
- Fully responsive design
- Smooth scrolling navigation
- Interactive game library
- Game details modal
- FAQ system
- Changelog section
- Discord integration
- Copy Script button
- Typewriter animation
- Optimized images
- Vercel ready deployment

## Supported Games

### Kick A Lucky Block
### Build A Ring Farm
### Slime RNG

## Tech Stack

- Next.js 16
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React
- Sonner

## Getting Started

Clone repository:

```bash
git clone https://github.com/erastushs/luxy-hub.git
```

Enter project directory:

```bash
cd luxy-hub
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build Production

```bash
npm run build
npm start
```

## Deployment

### Vercel

```bash
npm run build
```

Push to GitHub and import the repository into Vercel.

### Netlify

```bash
npm run build
```

Connect repository and deploy.

## Project Structure

```text
app/
├── components/
│   ├── Hero.tsx
│   ├── Navbar.tsx
│   ├── FeaturedGames.tsx
│   ├── GameModal.tsx
│   ├── Faq.tsx
│   ├── Changelog.tsx
│   ├── Footer.tsx
│   └── CustomCursor.tsx
│
├── data/
│   ├── games.ts
│   ├── faq.ts
│   ├── changelog.ts
│   └── config.ts
│
├── robots.ts
├── sitemap.ts
├── not-found.tsx
├── page.tsx
├── layout.tsx
└── globals.css

public/
├── LH.webp
├── LH2.webp
├── og-image.png
└── bg.webp
```

## Configuration

Edit:

```text
app/data/config.ts
```

Example:

```ts
export const config = {
  discord: 'https://discord.gg/your-server',
  script: 'loadstring(...)()',
}
```

## License

This project is provided for educational and personal use only.

## Author

LuxyHub Team

Website:
[https://luxyhub.vercel.app](https://luxyhub.vercel.app)

Discord:
[https://discord.gg/Gr5UQUKp7](https://discord.gg/Gr5UQUKp7)

---

Built with Next.js and Tailwind CSS. 🚀
