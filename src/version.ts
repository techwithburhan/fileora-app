/** App version: one source of truth (package.json), also used by Gradle for versionName/versionCode. */
import pkg from '../package.json';

export const APP_VERSION: string = pkg.version;
