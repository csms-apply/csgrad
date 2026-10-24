import React from 'react';
import Head from '@docusaurus/Head';
import {Redirect, useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {localizedInternalPath} from '../lib/seo/localizedAlternates.mjs';

// Older tracker cards and bookmarks used the program's previous tier.
export default function LegacyUclaMeng() {
  const {i18n: {currentLocale}, siteConfig: {url}} = useDocusaurusContext();
  const {search, hash} = useLocation();
  const destination = localizedInternalPath('/A+/UCLA MENG', currentLocale);

  return (
    <>
      <Head>
        <title>UCLA MEng</title>
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={`${url}${destination}`} />
      </Head>
      <Redirect to={`${destination}${search}${hash}`} />
      <a href={destination}>UCLA MEng</a>
    </>
  );
}
