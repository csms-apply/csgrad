import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import DefaultNavbarItem from '@theme/NavbarItem/DefaultNavbarItem';

export default function SchoolPlanNavbarItem(props) {
  const {i18n: {currentLocale}} = useDocusaurusContext();
  return currentLocale === 'en' ? <DefaultNavbarItem {...props} /> : null;
}
