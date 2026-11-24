/**
 * The party-popper sound after a successful task (app 1.0). Quiet (about a third of full volume),
 * only after a file is ready, and never when Settings → Appearance → "Celebration sound" is off.
 * The sound is made by the offline engine page with Web Audio, so the app carries no sound file.
 * On iPhone it follows the ring/silent switch.
 */
import { call } from '../engine/engine';
import { remote } from '../remote/remote';

let last = 0;
export function celebrate() {
  if (remote.prefs().celebrate === false) return;
  if (Date.now() - last < 1500) return; // one sound per result, also when two screens show confetti
  last = Date.now();
  call('sound', { volume: 0.35 }, 3000).catch(() => {});
}
