import { getSiteUrl } from '@/app/lib/site-url'

const loaderUrl = `${getSiteUrl()}/api/loader/luxyhub`

export const config = {
  discord: 'https://discord.gg/Gr5UQUKp7',

  scriptUrl: 'https://www.luxyhub.space/api/loader/luxyhub',
  typewriterMessages: [
    'Discover supported games.',
    'Track latest updates.',
    'Explore powerful features.',
    'Find scripts for your favorite Roblox games.',
    'Fast updates and stable releases.',
  ],
  mainScript: `loadstring(game:HttpGet("${loaderUrl}"))()`,
}
