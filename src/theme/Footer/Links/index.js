import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import FooterLinks from '@theme-original/Footer/Links';

export default function LocalizedFooterLinks({links, ...props}) {
  const {i18n: {currentLocale}} = useDocusaurusContext();
  const visible = (link) => !/^https?:\/\/(?:www\.)?(?:discord\.gg|discord\.com)\//i.test(link.href || '');
  const localizedLinks = currentLocale === 'zh-Hant'
    ? links.map((link) => link.items
      ? {...link, items: link.items.filter(visible)}
      : link).filter((link) => link.items ? link.items.length > 0 : visible(link))
    : links;
  return <FooterLinks {...props} links={localizedLinks} />;
}
