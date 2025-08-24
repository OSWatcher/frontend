import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OSWatcher Frontend',
  description: 'Technical reference documentation for OSWatcher Frontend',
  
  // Base path for deployment (adjust based on hosting platform)
  base: '/docs/',
  
  // Theme configuration
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Reference', link: '/reference/api' }
    ],

    sidebar: {
      '/reference/': [
        {
          text: 'Reference Documentation',
          items: [
            { text: 'API Reference', link: '/reference/api' },
            { text: 'Environment Variables', link: '/reference/environment' },
            { text: 'Types Reference', link: '/reference/types' },
            { text: 'Architecture Reference', link: '/reference/architecture' }
          ]
        }
      ]
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/OSWatcher/frontend' }
    ],

    // Footer
    footer: {
      message: 'OSWatcher Frontend Documentation',
      copyright: 'Copyright © 2025 OSWatcher'
    },

    // Search
    search: {
      provider: 'local'
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/OSWatcher/frontend/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  },

  // Markdown configuration
  markdown: {
    lineNumbers: true,
    // Enable code highlighting for specific languages
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  }
})