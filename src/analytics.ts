/**
 * Google Analytics for Firebase (free). Only anonymous usage: screens and tool names.
 * Never file names or file contents. Advertising ID and ad personalisation are off (firebase.json).
 */
import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

function analytics() {
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
