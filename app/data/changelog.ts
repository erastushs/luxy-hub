export type ChangelogEntry = {
  version: string
  date: string
  game: string
  summary: string
  changes: string[]
}

export const changelog: ChangelogEntry[] = [
  {
    version: 'v4.1',
    date: '1 Jun 2026',
    game: 'Build A Ring Farm',
    summary: 'Plant Rush, Contracts & Pet Automation',
    changes: [
      'Added Auto Fast Kill Plant Rush',
      'Added Auto Collect Plant Rush Drops',
      'Added Plant Plot Filter',
      'Added Plant Spray Filter',
      'Added Spray Type Filter',
      'Added Auto Spray Plant',
      'Added Contract Slot Filter',
      'Added Ignore Contract Seed Filter',
      'Added Auto Submit Contract',
      'Added Auto Reroll Contract',
      'Added Composter Floor Filter',
      'Added Pet Sell Filter',
      'Added Pet Rarity Sell Filter',
      'Added Inventory Pet Filter',
      'Added Auto Sell Pet',
      'Fixed Auto Buy Egg',
      'Fixed Realtime Plot Filter',
      'Fixed Auto Collect Honey',
      'Fixed Auto Save & Load',
      'Fixed Hidden Seed Placement',
      'Fixed Auto Attack Enemies',
      'Fixed Auto Composter Crash',
      'Fixed Auto Collect Alien Drops',
    ],
  },

  {
    version: 'v4.0',
    date: '31 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Event Automation & Enhanced Farming',
    changes: [
      'Added Event Tab',
      'Added Auto Battle',
      'Added Kick Mastery Farm',
      'Added Weather Automation',
      'Improved Brainrot List System',
      'Fixed Auto Favorite & Auto Kick',
    ],
  },

  {
    version: 'v3.9',
    date: '29 May 2026',
    game: 'Slime RNG',
    summary: 'Added New Script Support',
    changes: ['Now support for Slime RNG yet'],
  },

  {
    version: 'v3.8',
    date: '29 May 2026',
    game: 'Build A Ring Farm',
    summary: 'Added New Script Support',
    changes: ['Now support for Build A Ring Farm yet'],
  },

  {
    version: 'v3.7',
    date: '25 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Added New Filters & Improved Webhooks',
    changes: [
      'Added Orb Collection Filter',
      'Added AFK Farm & Event Logic',
      'Improved Discord Webhooks',
      'Fixed Auto Favorite',
    ],
  },

  {
    version: 'v3.6',
    date: '24 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Added New Farming Features & Fixes',
    changes: [
      'Added Anti AFK',
      'Added FPS Boost & RTX Shader',
      'Added Auto Potion System',
      'Added Auto Upgrade',
      'Multiple Farming Fixes',
    ],
  },

  {
    version: 'v3.5',
    date: '23 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Added Volcano Event Automation & Shop Support',
    changes: ['Added Volcano Event Automation', 'Added Auto Collect Orbs', 'Added Volcano Shop Support'],
  },

  {
    version: 'v3.4',
    date: '23 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Added New Teleport System & UI Improvements',
    changes: ['Added JobId Teleport', 'Added Kick Power Setting', 'UI & Configuration Improvements'],
  },

  {
    version: 'v3.1',
    date: '22 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Added New Filters, Webhooks & UI Enhancements',
    changes: [
      'Added Auto Favorite Filter',
      'Added Sell All System',
      'Added Webhook Support',
      'Added Config Save Dropdown',
      'New UI & Theme Icons',
    ],
  },

  {
    version: 'v2.6',
    date: '19 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Added New Auto Farming Features & Fixes',
    changes: [
      'Added Auto Train & Collect Cash',
      'Added Smart Brainrot Protection',
      'Improved Auto 2x Rewards',
      'Fixed Equip & Filter Issues',
    ],
  },

  {
    version: 'v2.5',
    date: '18 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Added New Mutation Filters',
    changes: ['Added Phantom Mutation Filter', 'Added Astral Mutation Filter', 'Added Anti Wave Support'],
  },

  {
    version: 'v2.4',
    date: '18 May 2026',
    game: 'Kick a Lucky Block',
    summary: 'Added New Mutation Filters',
    changes: [
      'Added Settings Tab',
      'Added Theme Customizer',
      'Improved Mobile UI Scaling',
      'Added Premium UI Effects',
      'Fixed Camera & Layout Issues',
    ],
  },
]
