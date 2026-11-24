/**
 * Google Analytics for Firebase (free). Only anonymous usage: screens and tool names.
 * Never file names or file contents. Advertising ID and ad personalisation are off (firebase.json).
 * Off when the person turns off Settings → "Share anonymous usage".
 */
import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent, setAnalyticsCollectionEnabled } from '@react-native-firebase/analytics';
import { effectivePrefs } from './remote/remote';

/** Follows Settings → "Share anonymous usage". */
export function setAnalyticsEnabled(on: boolean) {
  const a = getAnalytics0();
  if (!a) return;
  try {
    Promise.resolve(setAnalyticsCollectionEnabled(a, on)).catch(() => {});
  } catch {}
}

function getAnalytics0() {
  try {
    return getAnalytics(getApp());
  } catch {
    return null;
  }
}

function analytics() {
  if (!effectivePrefs().usage) return null;
  try {
    return getAnalytics(getApp());
  } catch {
    return null; // e.g. no google-services.json in a dev build
  }
}

export function trackScreen(screen: string) {
  const a = analytics();
  if (!a) return;
  try {
    Promise.resolve(logEvent(a, 'screen_view', { screen_name: screen, screen_class: screen })).catch(() => {});
  } catch {}
}

export function trackTool(toolId: string) {
  const a = analytics();
  if (!a) return;
  try {
    Promise.resolve(logEvent(a, 'tool_open', { tool: toolId })).catch(() => {});
  } catch {}
}
