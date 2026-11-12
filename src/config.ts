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

/** Website pages used by Settings (looked up by slug, so nothing breaks if a page is missing). */
export const CONTACT_SLUGS = ['contact', 'contact-us'];
export const TERMS_SLUGS = ['terms-and-conditions', 'terms-of-service', 'terms-of-use', 'terms'];
export const PRIVACY_SLUGS = ['privacy-policy', 'privacy'];
export const ABOUT_SLUGS = ['about-us', 'about'];

/** Link people share to get the app (the website, which links to the app). */
export const SHARE_URL = SITE;

export const DEVELOPER = { name: 'TechDeployers', handle: '@techdeployers', url: 'https://www.techdeployers.com' };

/**
 * API-based tools (Word/Excel/PowerPoint ↔ PDF, OCR, PDF/A, Protect, Unlock, Redact, PDF Forms,
 * Edit PDF, AI tools) need the Fileora processing server. Until it is live they are shown as
 * temporarily unavailable with MAINTENANCE_MESSAGE. Set to true (and build) when the server is live.
 */
export const API_TOOLS_LIVE = false;
export const MAINTENANCE_MESSAGE =
  'This service is currently unavailable due to server maintenance. We will enable this feature once the server is live. Thank you for your patience.';
