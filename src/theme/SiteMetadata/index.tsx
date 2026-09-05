/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {type ReactNode} from 'react';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {PageMetadata, useThemeConfig} from '@docusaurus/theme-common';
import {
  DEFAULT_SEARCH_TAG,
  useAlternatePageUtils,
  keyboardFocusedClassName,
} from '@docusaurus/theme-common/internal';
import {useLocation} from '@docusaurus/router';
import {applyTrailingSlash} from '@docusaurus/utils-common';
import SearchMetadata from '@theme/SearchMetadata';
import {localizedAlternateUrl} from '../../lib/seo/localizedAlternates.mjs';

function AlternateLangHeaders(): ReactNode {
  const {
    siteConfig: {url: siteUrl},
    i18n: {currentLocale, defaultLocale, localeConfigs},
  } = useDocusaurusContext();
  const alternatePageUtils = useAlternatePageUtils();
  const {pathname} = useLocation();
  const currentHtmlLang = localeConfigs[currentLocale]!.htmlLang;

  const createAlternateUrl = (locale: string) => localizedAlternateUrl({
    pathname,
    locale,
    siteUrl,
    fallback: (targetLocale: string) => alternatePageUtils.createUrl({
      locale: targetLocale,
      fullyQualified: true,
    }),
  });

  const bcp47ToOpenGraphLocale = (code: string): string =>
    code.replace('-', '_');

  return (
    <Head>
      {Object.entries(localeConfigs).map(([locale, {htmlLang}]) => (
        <link
          key={locale}
          rel="alternate"
          href={createAlternateUrl(locale)}
          hrefLang={htmlLang}
        />
      ))}
      <link
        rel="alternate"
        href={createAlternateUrl(defaultLocale)}
        hrefLang="x-default"
      />

      <meta
        property="og:locale"
        content={bcp47ToOpenGraphLocale(currentHtmlLang)}
      />
      {Object.values(localeConfigs)
        .filter((config) => currentHtmlLang !== config.htmlLang)
        .map((config) => (
          <meta
            key={`meta-og-${config.htmlLang}`}
            property="og:locale:alternate"
            content={bcp47ToOpenGraphLocale(config.htmlLang)}
          />
        ))}
    </Head>
  );
}

function useDefaultCanonicalUrl() {
  const {
    siteConfig: {url: siteUrl, baseUrl, trailingSlash},
  } = useDocusaurusContext();
  const {pathname} = useLocation();
  const canonicalPathname = applyTrailingSlash(useBaseUrl(pathname), {
    trailingSlash,
    baseUrl,
  });

  return siteUrl + canonicalPathname;
}

function CanonicalUrlHeaders({permalink}: {permalink?: string}) {
  const {
    siteConfig: {url: siteUrl},
  } = useDocusaurusContext();
  const defaultCanonicalUrl = useDefaultCanonicalUrl();
  const canonicalUrl = permalink
    ? `${siteUrl}${permalink}`
    : defaultCanonicalUrl;

  return (
    <Head>
      <meta property="og:url" content={canonicalUrl} />
      <link rel="canonical" href={canonicalUrl} />
    </Head>
  );
}

export default function SiteMetadata(): ReactNode {
  const {
    i18n: {currentLocale},
  } = useDocusaurusContext();
  const {metadata, image: defaultImage} = useThemeConfig();

  return (
    <>
      <Head>
        <meta name="twitter:card" content="summary_large_image" />
        <body className={keyboardFocusedClassName} />
      </Head>

      {defaultImage && <PageMetadata image={defaultImage} />}

      <CanonicalUrlHeaders />
      <AlternateLangHeaders />
      <SearchMetadata tag={DEFAULT_SEARCH_TAG} locale={currentLocale} />

      <Head>
        {metadata.map((metadatum, i) => (
          <meta key={i} {...metadatum} />
        ))}
      </Head>
    </>
  );
}
