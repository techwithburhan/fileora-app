/** Website addresses used by the app (no keys or secrets: the app talks only to the public website). */
export const SITE = 'https://www.fileora.in';
export const SITE_HOSTS = ['www.fileora.in', 'fileora.in'];

export const toolUrl = (slug: string) => `${SITE}/${slug}/`;

export const PAGES = {
  resume: `${SITE}/ats-resume-builder/`,
  blog: `${SITE}/blog/`,
  apiStatus: `${SITE}/api-status/`,
};

/** Information pages: the first slug that exists on the site is used (same order as the theme). */
export const INFO_PAGES: { key: string; title: string; slugs: string[] }[] = [
  { key: 'about', title: 'About us', slugs: ['about-us', 'about'] },
  { key: 'faq', title: 'FAQ', slugs: ['faq'] },
  { key: 'security', title: 'Security', slugs: ['security'] },
  { key: 'privacy', title: 'Privacy policy', slugs: ['privacy-policy', 'privacy'] },
  { key: 'disclaimer', title: 'Disclaimer', slugs: ['disclaimer'] },
  { key: 'accessibility', title: 'Accessibility', slugs: ['accessibility'] },
];

export const DEVELOPER = { name: 'TechDeployers', url: 'https://www.techdeployers.com' };
