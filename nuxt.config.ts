import tailwindcss from '@tailwindcss/vite'

const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || ''
const withHttps = (value: string) => value.startsWith('http') ? value : `https://${value}`
const siteUrl = (
  process.env.NUXT_PUBLIC_SITE_URL ||
  process.env.NUXT_PUBLIC_APP_URL ||
  process.env.URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? withHttps(process.env.VERCEL_PROJECT_PRODUCTION_URL) : '') ||
  (process.env.VERCEL_URL ? withHttps(process.env.VERCEL_URL) : '') ||
  ''
).replace(/\/+$/, '')

export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/supabase', '@vercel/speed-insights/nuxt', '@vercel/analytics'],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    pageTransition: {
      name: 'arena-page',
      mode: 'out-in',
    },
    head: {
      title: 'Quiniela Mundial 2026',
      link: [
        {
          rel: 'icon',
          href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚽</text></svg>',
        },
      ],
      htmlAttrs: {
        'data-theme': 'dark',
      },
    },
  },
  supabase: {
    url: supabaseUrl,
    key: supabaseAnonKey,
    redirect: false,
  },
  runtimeConfig: {
    apiFootballKey: process.env.API_FOOTBALL_KEY || '',
    apiFootballLeagueId: process.env.API_FOOTBALL_LEAGUE_ID || '',
    apiFootballSeason: process.env.API_FOOTBALL_SEASON || '',
    apiFootballDailyBudget: process.env.API_FOOTBALL_DAILY_BUDGET || '100',
    apiFootballMinSyncMinutes: process.env.API_FOOTBALL_MIN_SYNC_MINUTES || '15',
    public: {
      siteUrl,
      supabaseUrl,
      supabaseAnonKey,
    },
  },
})
