import { createResolver, useNuxt } from '@nuxt/kit'
import { isCI, isDevelopment, isWindows } from 'std-env'
import { isPreview } from './config/env'
import { pwa } from './config/pwa'
import type { BuildInfo } from './types'
import { currentLocales } from './config/i18n'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  typescript: {
    tsConfig: {
      exclude: ['../service-worker'],
      vueCompilerOptions: {
        target: 3.4,
      },
    },
  },
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@vue-macros/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
    '@unlazy/nuxt',
    '@nuxt/test-utils/module',
    ...(isDevelopment || isWindows) ? [] : ['nuxt-security'],
    '~/modules/emoji-mart-translation',
    '~/modules/purge-comments',
    '~/modules/build-env',
    '~/modules/tauri/index',
    '~/modules/pwa/index', // change to '@vite-pwa/nuxt' once released and remove pwa module
    'stale-dep/nuxt',
  ],
  vue: {
    propsDestructure: true,
  },
  macros: {
    setupSFC: true,
    betterDefine: false,
    defineModels: false,
    reactivityTransform: false,
  },
  devtools: {
    enabled: true,
  },
  features: {
    inlineStyles: false,
  },
  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true,
  },
  css: [
    '@unocss/reset/tailwind.css',
    'floating-vue/dist/style.css',
    '~/styles/default-theme.css',
    '~/styles/vars.css',
    '~/styles/global.css',
    ...process.env.TAURI_PLATFORM === 'macos'
      ? []
      : ['~/styles/scrollbars.css'],
    '~/styles/tiptap.css',
    '~/styles/dropdown.css',
  ],
  alias: {
    'querystring': 'rollup-plugin-node-polyfills/polyfills/qs',
    'change-case': 'scule',
    'semver': resolve('./mocks/semver'),
  },
  imports: {
    dirs: [
      './composables/masto',
      './composables/push-notifications',
      './composables/settings',
      './composables/tiptap/index.ts',
    ],
    imports: [{
      name: 'useI18n',
      from: '~/utils/i18n',
      priority: 100,
    }],
    injectAtEnd: true,
  },
  vite: {
    define: {
      'process.env.VSCODE_TEXTMATE_DEBUG': 'false',
      'process.mock': ((!isCI || isPreview) && process.env.MOCK_USER) || 'false',
      'process.test': 'false',
    },
    build: {
      target: 'esnext',
    },
    optimizeDeps: {
      include: [
        '@tiptap/vue-3', 'string-length', 'vue-virtual-scroller', 'emoji-mart', 'iso-639-1',
        '@tiptap/extension-placeholder', '@tiptap/extension-document', '@tiptap/extension-paragraph',
        '@tiptap/extension-text', '@tiptap/extension-mention', '@tiptap/extension-hard-break',
        '@tiptap/extension-bold', '@tiptap/extension-italic', '@tiptap/extension-code',
        '@tiptap/extension-history', 'prosemirror-state', 'browser-fs-access', 'blurhash',
        '@vueuse/integrations/useFocusTrap', '@tiptap/extension-code-block', 'prosemirror-highlight',
        '@tiptap/core', 'tippy.js', 'prosemirror-highlight/shiki', '@fnando/sparkline',
        '@vueuse/gesture', 'github-reserved-names', 'file-saver', 'slimeform', 'vue-advanced-cropper',
        'workbox-window', 'workbox-precaching', 'workbox-routing', 'workbox-cacheable-response',
        'workbox-strategies', 'workbox-expiration',
      ],
    },
  },
  postcss: {
    plugins: {
      'postcss-nested': {},
    },
  },
  appConfig: {
    storage: {
      driver: process.env.NUXT_STORAGE_DRIVER ?? (isCI ? 'cloudflare' : 'fs'),
    },
  },
  runtimeConfig: {
    adminKey: '',
    cloudflare: {
      accountId: process.env.NUXT_CLOUDFLARE_ACCOUNT_ID,
      namespaceId: process.env.NUXT_CLOUDFLARE_NAMESPACE_ID,
      apiToken: process.env.NUXT_CLOUDFLARE_API_TOKEN,
    },
    vercel: {
      url: '',
      token: '',
      env: '',
      base: '',
    },
    public: {
      privacyPolicyUrl: '',
      // We use LibreTranslate (https://github.com/LibreTranslate/LibreTranslate) as
      // our default translation server #76
      translateApi: '',
      // Use the instance where Elk has its Mastodon account as the default
      defaultServer: 'm.webtoo.ls',
      singleInstance: false,
    },
    storage: {
      fsBase: 'node_modules/.cache/app',
    },
  },
  routeRules: {
    // Static generation
    '/': { prerender: true },
    '/settings/**': { prerender: false },
    // incremental regeneration
    '/api/list-servers': { swr: true },
    // CDN cache rules
    '/manifest.webmanifest': {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    },
  },
  nitro: {
    alias: {
      'isomorphic-ws': 'unenv/runtime/mock/proxy',
    },
    esbuild: {
      options: {
        target: 'esnext',
      },
    },
    prerender: {
      crawlLinks: true,
    },
    publicAssets: [
      {
        dir: '~/public/avatars',
        maxAge: 24 * 60 * 60 * 30, // 30 days
        baseURL: '/avatars',
      },
      {
        dir: '~/public/emojis',
        maxAge: 24 * 60 * 60 * 15, // 15 days, matching service worker
        baseURL: '/emojis',
      },
      {
        dir: '~/public/fonts',
        maxAge: 24 * 60 * 60 * 365, // 1 year (versioned)
        baseURL: '/fonts',
      },
    ],
  },
  sourcemap: isDevelopment,
  hooks: {
    'prepare:types': function ({ references }) {
      references.push({ types: '@types/wicg-file-system-access' })
    },
    'nitro:config': function (config) {
      const nuxt = useNuxt()
      config.virtual = config.virtual || {}
      config.virtual['#storage-config'] = `export const driver = ${JSON.stringify(nuxt.options.appConfig.storage.driver)}`
    },
    'vite:extendConfig': function (config, { isServer }) {
      if (isServer) {
        const alias = config.resolve!.alias as Record<string, string>
        for (const dep of ['eventemitter3', 'isomorphic-ws'])
          alias[dep] = resolve('./mocks/class')
        for (const dep of ['fuse.js'])
          alias[dep] = 'unenv/runtime/mock/proxy'
        const resolver = createResolver(import.meta.url)

        config.plugins!.unshift({
          name: 'mock',
          enforce: 'pre',
          resolveId(id) {
            if (id.match(/(^|\/)(@tiptap)\//))
              return resolver.resolve('./mocks/tiptap.ts')
            if (id.match(/(^|\/)(prosemirror)/))
              return resolver.resolve('./mocks/prosemirror.ts')
          },
        })

        const noExternal = config.ssr!.noExternal as string[]
        noExternal.push('masto', '@fnando/sparkline', 'vue-i18n', '@mastojs/ponyfills')
      }
    },
  },
  app: {
    keepalive: true,
    head: {
      viewport: 'width=device-width,initial-scale=1,viewport-fit=cover',
      bodyAttrs: {
        class: 'overflow-x-hidden',
      },
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        // open graph social image
        { property: 'og:title', content: 'Elk' },
        { property: 'og:description', content: 'A nimble Mastodon web client' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: 'https://elk.zone/elk-og.png' },
        { property: 'og:image:width', content: '3800' },
        { property: 'og:image:height', content: '1900' },
        { property: 'og:site_name', content: 'Elk' },
        { property: 'twitter:site', content: '@elk_zone' },
        { property: 'twitter:card', content: 'summary_large_image' },
      ],
    },
  },
  // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
  // @ts-ignore nuxt-security is conditional
  security: {
    headers: {
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        'default-src': ['\'self\''],
        'base-uri': ['\'self\''],
        'connect-src': ['\'self\'', 'https:', 'http:', 'wss:', 'ws:'],
        'font-src': ['\'self\''],
        'form-action': ['\'none\''],
        'frame-ancestors': ['\'none\''],
        'frame-src': ['https:'],
        'img-src': ['\'self\'', 'https:', 'http:', 'data:', 'blob:'],
        'manifest-src': ['\'self\''],
        'media-src': ['\'self\'', 'https:', 'http:'],
        'object-src': ['\'none\''],
        'script-src': ['\'self\'', '\'unsafe-inline\'', '\'wasm-unsafe-eval\''],
        'script-src-attr': ['\'none\''],
        'style-src': ['\'self\'', '\'unsafe-inline\''],
        'upgrade-insecure-requests': true,
      },
      permissionsPolicy: {
        fullscreen: ['\'self\'', 'https:', 'http:'],
      },
    },
    rateLimiter: false,
  },
  colorMode: { classSuffix: '' },
  i18n: {
    locales: currentLocales,
    lazy: true,
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
    langDir: 'locales',
    defaultLocale: 'en-US',
    vueI18n: './config/i18n.config.ts',
  },
  pwa,
  staleDep: {
    packageManager: 'pnpm',
  },
  unlazy: {
    ssr: false,
  },
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      mock?: Record<string, any>
    }
  }
}

declare module '#app' {
  interface RuntimeNuxtHooks {
    'elk-logo:click': () => void
  }
}

declare module '@nuxt/schema' {
  interface AppConfig {
    storage: any
    env: BuildInfo['env']
    buildInfo: BuildInfo
  }
}
