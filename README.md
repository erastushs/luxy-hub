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

- Auto Kick & Predict
- Auto Train & Collect Cash
- Auto Rebirth
- Auto Upgrade Plot
- Auto Place & Upgrade Brainrot
- Auto Battle & Mastery Farm
- Auto Weather Summoner
- Auto Buy & Sell
- Discord Webhook Integration
- FPS Boost
- RTX Shader
- Anti AFK

### Build A Ring Farm

- Auto Buy & Roll Seeds
- Auto Plant & Manage Farm
- Auto Unlock Plots
- Auto Upgrade Seeds
- Auto Expand Farm
- Auto Upgrade Floor Stats
- Auto Composter
- Auto Buy Eggs & Gear
- Auto Sell System
- Plant Rush Event Automation

### Slime RNG

- Auto Roll
- Auto Equip Best Slime
- Auto Farm Zones
- Auto Rebirth
- Auto Gun
- Auto Upgrade Trees
- Auto Craft
- Auto Collect Loots
- Auto Claim Index
- Auto Feed Pets
- Auto Use Potions
- Auto Use Fruits
- ESP Loot & Orbs
- FPS Boost
- Noclip

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
│   ├── Footer.tsx
│   └── Changelog.tsx
│
├── data/
│   ├── games.ts
│   ├── faq.ts
│   ├── changelog.ts
│   └── config.ts
│
├── page.tsx
├── layout.tsx
└── globals.css

public/
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
