/**
 * The app's bottom bar and side menu ("Fileora" section), managed in WordPress
 * (Fileora → App Center → Navigation). Without settings from the website, the built-in
 * navigation below is used (the same as app 0.5).
 *
 * Items open an app screen, a tool category, a tool or a web page. "Coming soon" and
 * "Disabled" items show a message instead of opening.
 */
import { Alert } from 'react-native';
import { useMemo } from 'react';
import { IconName, ICON_NAMES } from '../components/Icon';
import { CONTACT_SLUGS, PAGES } from '../config';
import { isAvailable, isHidden, toolById, toolState } from '../data/tools';
import { maintenanceMessage, Nav, NavItem, remote, soonMessage, useRemote } from '../remote/remote';
import { openLink } from '../lib/links';
import { navigationRef, TabParamList } from './types';

const item = (id: string, label: string, icon: string, value: string): NavItem => ({ id, label, icon, open: 'screen', value, status: 'on', msg: '' });

export const DEFAULT_NAV: Nav = {
  bar: [
    item('home', 'Home', 'home', 'home'),
    item('tools', 'Tools', 'grid', 'tools'),
    item('scanner', 'Scanner', 'scan', 'scanner'),
    item('files', 'Files', 'folder', 'files'),
    item('alerts', 'Alerts', 'bell', 'alerts'),
    item('settings', 'Settings', 'settings', 'settings'),
  ],
  menu: [
    item('home', 'Home', 'home', 'home'),
    item('scanner', 'Scanner', 'scan', 'scanner'),
    item('files', 'Files', 'folder', 'files'),
    item('promo', 'Promotions', 'party', 'promo'),
    item('blog', 'Blog', 'blog', 'blog'),
    item('settings', 'Settings', 'settings', 'settings'),
    item('contact', 'Contact us', 'mail', 'contact'),
    item('status', 'API Status', 'pulse', 'status'),
  ],
};

/** Screens that are tabs of the bottom bar. */
export const TAB_OF: Record<string, keyof TabParamList> = {
  home: 'Home',
  tools: 'Tools',
  scanner: 'Scanner',
  files: 'Files',
  alerts: 'Alerts',
  settings: 'Settings',
};

/** Promotions only while App Center has something to show (an older plugin never does). */
function withoutEmptyPromo(nav: Nav, hasPromo: boolean): Nav {
  if (hasPromo) return nav;
  const keep = (i: NavItem) => !(i.open === 'screen' && i.value === 'promo');
  return { bar: nav.bar.filter(keep), menu: nav.menu.filter(keep) };
}

export function currentNav(): Nav {
  const c = remote.get().config;
  return withoutEmptyPromo(c?.nav ?? DEFAULT_NAV, !!c?.promo);
}

export function useNav(): Nav {
  const nav = useRemote(s => s.config?.nav ?? null);
  const hasPromo = useRemote(s => !!s.config?.promo);
  return useMemo(() => withoutEmptyPromo(nav ?? DEFAULT_NAV, hasPromo), [nav, hasPromo]);
}

export function navIcon(i: NavItem): IconName {
  return (ICON_NAMES as readonly string[]).includes(i.icon) ? (i.icon as IconName) : 'info';
}

/**
 * State of an app feature (a screen) from the navigation: "on", "soon", "off", or "hidden"
 * when no shown item opens it. A screen shown anywhere as "on" counts as on.
 */
export function screenState(screen: string, nav: Nav = currentNav()): 'on' | 'soon' | 'off' | 'hidden' {
  const items = [...nav.bar, ...nav.menu].filter(i => i.open === 'screen' && i.value === screen);
  if (!items.length) return 'hidden';
  if (items.some(i => i.status === 'on')) return 'on';
  return items.some(i => i.status === 'soon') ? 'soon' : 'off';
}

export function useScreenState(screen: string) {
  const nav = useNav();
  return screenState(screen, nav);
}

function message(i: NavItem) {
  const text = i.msg || (i.status === 'soon' ? 'This is coming soon.' : 'This isn’t available right now.');
  Alert.alert(i.label, text);
}

/** Message for a feature that is switched off in App Center (used by Home buttons, deep links…). */
export function featureMessage(screen: string, label: string) {
  const nav = currentNav();
  const i = [...nav.bar, ...nav.menu].find(x => x.open === 'screen' && x.value === screen && x.msg);
  Alert.alert(label, i?.msg || (screenState(screen, nav) === 'soon' ? 'This is coming soon.' : 'This isn’t available right now.'));
}

/** Opens what a navigation item points to (or explains why it can't). */
export function openNavItem(i: NavItem) {
  if (i.status !== 'on') {
    message(i);
    return;
  }
  if (!navigationRef.isReady()) return;
  const nav = navigationRef;
  if (i.open === 'screen') {
    const tab = TAB_OF[i.value];
    if (tab === 'Tools') nav.navigate('Tabs', { screen: 'Tools', params: { cat: 'all' } });
    else if (tab) nav.navigate('Tabs', { screen: tab } as never);
    else if (i.value === 'blog') nav.navigate('Blog');
    else if (i.value === 'promo') {
      if (remote.get().config?.promo) nav.navigate('Promo');
      else Alert.alert(i.label, 'There are no promotions right now.');
    }
    else if (i.value === 'activity') nav.navigate('Activity', { tab: 'downloaded' });
    else if (i.value === 'cloud') nav.navigate('Cloud');
    else if (i.value === 'bin') nav.navigate('RecycleBin');
    else if (i.value === 'contact') {
      const url = remote.get().config?.links.contact;
      nav.navigate('Web', url ? { title: i.label, url } : { title: i.label, slugs: CONTACT_SLUGS });
    } else if (i.value === 'status') nav.navigate('Web', { title: i.label, url: PAGES.apiStatus });
  } else if (i.open === 'cat') {
    nav.navigate('Tabs', { screen: 'Tools', params: { cat: i.value as never } });
  } else if (i.open === 'tool') {
    const t = toolById(i.value);
    if (!t || isHidden(t)) Alert.alert(i.label, 'This tool isn’t available right now.');
    else if (!isAvailable(t)) Alert.alert(t.name, toolState(t) === 'soon' ? soonMessage() : maintenanceMessage());
    else nav.navigate('Tool', { id: t.id });
  } else if (i.open === 'url') {
    openLink(i.value, i.label);
  }
}
