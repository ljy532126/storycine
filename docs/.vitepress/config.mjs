import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'StoryCine',
  description: '全自动 AI 短剧生成平台使用教程',
  base: '/storycine/',

  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: '指南', link: '/guide/' },
      { text: 'GitHub', link: 'https://github.com/ljy532126/storycine' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '快速开始',
          items: [
            { text: '部署教程', link: '/guide/deploy' },
            { text: '配置 LLM', link: '/guide/config-llm' },
            { text: '创建第一个项目', link: '/guide/first-project' },
          ],
        },
        {
          text: '功能教程',
          items: [
            { text: '剧本工坊', link: '/guide/script-generate' },
            { text: '分镜台本', link: '/guide/script-edit' },
            { text: '演员库', link: '/guide/assets' },
            { text: '镜头板', link: '/guide/storyboard' },
            { text: '成片合成', link: '/guide/composition' },
          ],
        },
        {
          text: '其他',
          items: [
            { text: '管理员功能', link: '/guide/admin' },
            { text: '常见问题', link: '/guide/faq' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ljy532126/storycine' },
    ],

    search: {
      provider: 'local',
    },
  },
})
