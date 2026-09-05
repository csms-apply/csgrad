// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'CS Grad',
  tagline: '北美 CS/MSCS 申请与选校指南',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://csgrad.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  deploymentBranch: 'gh-pages',
  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'csms-apply', // Usually your GitHub org/user name.
  projectName: 'csgrad', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  onBrokenMarkdownLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
    localeConfigs: {
      'zh-Hans': {
        label: '中文',
        htmlLang: 'zh-Hans',
      },
      en: {
        label: 'English',
        htmlLang: 'en-US',
      },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/csms-apply/csgrad/tree/main',
        },

        sitemap: {
          // These routes are account, submission, or personalized-result pages.
          // Keep both the default and locale-prefixed variants out of sitemaps.
          ignorePatterns: [
            '**/datapoints submit',
            '**/my-dp',
            '**/school-positioning-result',
            '**/submit-dp',
          ],
        },

        theme: {
          customCss: './src/css/custom.css',
        },

        gtag: {
          trackingID: 'G-1WE3Z8WE8Z',
          anonymizeIP: true,
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      metadata: [{property: 'og:site_name', content: 'CS Grad'}],
      navbar: {
        title: 'CS Grad',
        logo: {
          alt: 'CS Grad Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: '项目介绍',
          },
          {
            to: '/datapoints',
            position: 'left',
            label: 'DataPoints',
          },
          {
            to: '/tracker',
            position: 'left',
            label: '申请跟踪',
          },
          {
            href: 'https://github.com/csms-apply/csgrad',
            label: 'GitHub',
            position: 'right',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: '探索',
            items: [
              {
                label: '项目介绍',
                to: '/',
              },
              {
                label: '录取数据',
                to: '/datapoints',
              },
              {
                label: '申请跟踪',
                to: '/tracker',
              },
            ],
          },
          {
            title: '社区',
            items: [
              {
                label: 'CS Grad Discord',
                href: 'https://discord.gg/g9x4WCX2xz',
              },
            ],
          },
          {
            title: '关于项目',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/csms-apply/csgrad',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} CS Grad`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
