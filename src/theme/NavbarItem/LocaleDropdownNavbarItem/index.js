/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useAlternatePageUtils} from '@docusaurus/theme-common/internal';
import {translate} from '@docusaurus/Translate';
import {useLocation} from '@docusaurus/router';
import useIsBrowser from '@docusaurus/useIsBrowser';
import DropdownNavbarItem from '@theme/NavbarItem/DropdownNavbarItem';
import IconLanguage from '@theme/Icon/Language';
import {localizedAlternateUrl} from '../../../lib/seo/localizedAlternates.mjs';

import styles from './styles.module.css';

export default function LocaleDropdownNavbarItem({
  mobile,
  dropdownItemsBefore,
  dropdownItemsAfter,
  queryString = '',
  ...props
}) {
  const {
    i18n: {currentLocale, locales, localeConfigs},
  } = useDocusaurusContext();
  const alternatePageUtils = useAlternatePageUtils();
  const {pathname, search, hash} = useLocation();
  const isBrowser = useIsBrowser();

  const localeItems = locales.map((locale) => {
    const localizedPath = localizedAlternateUrl({
      pathname,
      locale,
      siteUrl: '',
      fallback: (targetLocale) => alternatePageUtils.createUrl({
        locale: targetLocale,
        fullyQualified: false,
      }),
    });
    const baseTo = `pathname://${localizedPath}`;
    // Static HTML cannot know the visitor's query/hash. Match that HTML during
    // hydration, then update the link so React does not leave a stale SSR href.
    const liveSearch = isBrowser ? search : '';
    const extraQuery = queryString.replace(/^[?&]/, '');
    const combinedSearch = extraQuery
      ? `${liveSearch || '?'}${liveSearch ? '&' : ''}${extraQuery}`
      : liveSearch;
    const to = `${baseTo}${combinedSearch}${isBrowser ? hash : ''}`;
    return {
      label: localeConfigs[locale].label,
      lang: localeConfigs[locale].htmlLang,
      to,
      target: '_self',
      autoAddBaseUrl: false,
      className:
        locale === currentLocale
          ? mobile
            ? 'menu__link--active'
            : 'dropdown__link--active'
          : '',
    };
  });

  const items = [...dropdownItemsBefore, ...localeItems, ...dropdownItemsAfter];
  const dropdownLabel = mobile
    ? translate({
        message: 'Languages',
        id: 'theme.navbar.mobileLanguageDropdown.label',
        description: 'The label for the mobile language switcher dropdown',
      })
    : localeConfigs[currentLocale].label;

  return (
    <DropdownNavbarItem
      {...props}
      mobile={mobile}
      label={
        <>
          <IconLanguage className={styles.iconLanguage} />
          {dropdownLabel}
        </>
      }
      items={items}
    />
  );
}
