/**
 * Whether this build has Fileora's own AdMob App IDs (set by the GitHub workflows from the
 * repository variables ADMOB_ANDROID_APP_ID / ADMOB_IOS_APP_ID). Without them the build uses
 * Google's sample App IDs, which can only serve Google's test ads: then the app shows ads only
 * when App Center → Ads → "Test ads" is on.
 */
export const ADMOB_APP_ID_LIVE = false;
