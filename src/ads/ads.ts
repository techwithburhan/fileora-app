/**
 * Google AdMob ads, managed from WordPress (App Center → Ads), placed as in the approved designs:
 *   home_native        one native card on Home (Categories → Popular tools)
 *   tool_banner        anchored banner at the bottom of a tool's page
 *   task_interstitial  full-screen ad after a finished task, before the result
 *   result_rect        300×250 at the bottom of the result sheet
 *   reward_adfree      rewarded video, only after the person taps "Watch": no ads for some hours
 *
 * Nothing loads unless App Center switches a placement on: then the SDK starts, after Google's
 * consent form where the law requires it (UMP). Ads never block the app: a slot that doesn't
 * fill simply stays empty, and the full-screen ad is shown only if it is already loaded.
 *
 * State on this phone (DocumentDir/fileora/ads.json): finished tasks, the last full-screen ad,
 * and "ad-free until".
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { DATA } from '../store/files';
import { onFlush, readJsonSafe, writeJsonSafe } from '../lib/safeFile';
import { AdPlacement, remote, useRemote } from '../remote/remote';
import { ADMOB_APP_ID_LIVE } from './build';

const TEST: Record<AdPlacement, string> = {
  home_native: TestIds.NATIVE,
  tool_banner: TestIds.ADAPTIVE_BANNER,
  task_interstitial: TestIds.INTERSTITIAL,
  result_rect: TestIds.BANNER,
  reward_adfree: TestIds.REWARDED,
};

/* ---------- state on this phone ---------- */

type State = {
  tasks: number;
  sinceAd: number;
  lastAd: number;
  adFreeUntil: number;
};
const FILE = `${DATA}/ads.json`;
let state: State = { tasks: 0, sinceAd: 0, lastAd: 0, adFreeUntil: 0 };
let loaded = false;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (timer) clearTimeout(timer);
  timer = null;
  return loaded ? writeJsonSafe(FILE, state) : Promise.resolve();
}
onFlush(() => (timer ? save() : undefined));
function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach(l => l());
  if (timer) clearTimeout(timer);
  timer = setTimeout(save, 300);
}

export async function loadAds() {
  const d = await readJsonSafe<Partial<State>>(FILE).catch(() => null);
  if (d)
    state = {
      tasks: Number(d.tasks) || 0,
      sinceAd: Number(d.sinceAd) || 0,
      lastAd: Number(d.lastAd) || 0,
      adFreeUntil: Number(d.adFreeUntil) || 0,
    };
  loaded = true;
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/* ---------- which ads may show ---------- */

/** "Ad-free until" (ms), 0 when ads are on. */
export function adFreeUntil(): number {
  return state.adFreeUntil > Date.now() ? state.adFreeUntil : 0;
}

export function useAdFreeUntil(): number {
  return useSyncExternalStore(subscribe, adFreeUntil);
}

/**
 * The ad unit for a placement, or null when it shouldn't show: switched off in App Center,
 * no ad unit for this platform, ad-free hours running, or a build without Fileora's App ID
 * (then only Google's test ads, with "Test ads" on).
 */
export function unitFor(p: AdPlacement): string | null {
  const c = remote.get().config?.ads;
  if (!c?.on) return null;
  const u = c.units[p];
  if (!u) return null;
  if (adFreeUntil()) return null;
  if (u === 'test') return TEST[p];
  return ADMOB_APP_ID_LIVE ? u : null;
}

/* ---------- consent and start ---------- */

let starting: Promise<boolean> | null = null;
let started = false;

/** Google's consent form where required (EEA, UK…), then the SDK. Once per app start. */
export function ensureAds(): Promise<boolean> {
  if (!starting)
    starting = (async () => {
      let can = false;
      try {
        can = (await AdsConsent.gatherConsent()).canRequestAds;
      } catch {
        // offline: an earlier answer still counts
        can = await AdsConsent.getConsentInfo()
          .then(i => i.canRequestAds)
          .catch(() => false);
      }
      if (!can) {
        starting = null; // ask again next time
        return false;
      }
      try {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.PG,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        await mobileAds().initialize();
        started = true;
        listeners.forEach(l => l());
        return true;
      } catch {
        starting = null;
        return false;
      }
    })();
  return starting;
}

/** The unit to load in a component, once the SDK is ready (null = show nothing). */
export function useAdUnit(p: AdPlacement): string | null {
  const ads = useRemote(s => s.config?.ads);
  const free = useAdFreeUntil();
  const ready = useSyncExternalStore(subscribe, () => started);
  const unit = useMemo(() => unitFor(p), [p, ads, free]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (unit && !started) ensureAds();
  }, [unit]);
  return unit && ready ? unit : null;
}

/** Settings → "Privacy choices": only where Google says people must be able to change consent. */
export function usePrivacyOptions(): boolean {
  const ads = useRemote(s => s.config?.ads?.on === true);
  const [req, setReq] = useState(false);
  useEffect(() => {
    if (!ads) return;
    AdsConsent.getConsentInfo()
      .then(i =>
        setReq(
          i.privacyOptionsRequirementStatus ===
            AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
        ),
      )
      .catch(() => {});
  }, [ads]);
  return ads && req;
}

export function showPrivacyOptions() {
  return AdsConsent.showPrivacyOptionsForm().catch(() => {});
}

/* ---------- full-screen ad after a finished task ---------- */

let inter: InterstitialAd | null = null;
let interUnit = '';
let interLoading = false;

/** Loads a full-screen ad in the background (when a tool screen opens), so it is ready later. */
export function prepareInterstitial() {
  const unit = unitFor('task_interstitial');
  if (!unit) return;
  ensureAds().then(ok => {
    if (!ok || (inter && interUnit === unit && (inter.loaded || interLoading)))
      return;
    const ad = InterstitialAd.createForAdRequest(unit);
    inter = ad;
    interUnit = unit;
    interLoading = true;
    ad.addAdEventListener(AdEventType.LOADED, () => {
      interLoading = false;
    });
    ad.addAdEventListener(AdEventType.ERROR, () => {
      interLoading = false;
      if (inter === ad) inter = null;
    });
    ad.load();
  });
}

/**
 * A task finished: counts it and, within App Center's limits, shows the full-screen ad before
 * the result. Resolves when the ad was closed, or at once when there is none to show.
 */
export function afterTask(): Promise<void> {
  set({ tasks: state.tasks + 1, sinceAd: state.sinceAd + 1 });
  const c = remote.get().config?.ads;
  const unit = unitFor('task_interstitial');
  if (!c || !unit) return Promise.resolve();
  const due =
    state.tasks > c.skip &&
    state.sinceAd >= c.every &&
    Date.now() - state.lastAd >= c.gap * 60000;
  const ad = inter;
  if (!due || !ad || !ad.loaded) {
    if (due) prepareInterstitial();
    return Promise.resolve();
  }
  return new Promise(resolve => {
    let done = false;
    const offs: (() => void)[] = [];
    const finish = () => {
      if (done) return;
      done = true;
      offs.forEach(off => off());
      clearTimeout(guard);
      if (inter === ad) inter = null;
      resolve();
    };
    offs.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
    offs.push(ad.addAdEventListener(AdEventType.ERROR, finish));
    const guard = setTimeout(finish, 120000); // never keep the result waiting for good
    set({ sinceAd: 0, lastAd: Date.now() });
    ad.show().catch(finish);
  });
}

/* ---------- rewarded: hours without ads ---------- */

export function rewardHours(): number {
  return remote.get().config?.ads?.reward_hours ?? 24;
}

/** Plays a rewarded video (only after the person chose to). "ok" = ad-free hours started. */
export async function watchForAdFree(): Promise<'ok' | 'closed' | 'noad'> {
  const unit = unitFor('reward_adfree');
  if (!unit || !(await ensureAds())) return 'noad';
  return new Promise(resolve => {
    const ad = RewardedAd.createForAdRequest(unit);
    let earned = false;
    let settled = false;
    const offs: (() => void)[] = [];
    const done = (r: 'ok' | 'closed' | 'noad') => {
      if (settled) return;
      settled = true;
      clearTimeout(waiting);
      offs.forEach(off => off());
      resolve(r);
    };
    const waiting = setTimeout(() => done('noad'), 20000); // no video within 20 s: give up
    offs.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(waiting);
        ad.show().catch(() => done('noad'));
      }),
    );
    offs.push(
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
        set({ adFreeUntil: Date.now() + rewardHours() * 3600000 });
      }),
    );
    offs.push(
      ad.addAdEventListener(AdEventType.CLOSED, () =>
        done(earned ? 'ok' : 'closed'),
      ),
    );
    offs.push(
      ad.addAdEventListener(AdEventType.ERROR, () =>
        done(earned ? 'ok' : 'noad'),
      ),
    );
    ad.load();
  });
}
