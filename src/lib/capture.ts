/**
 * Photos for the scanner: the phone's own camera app (so Fileora needs no camera permission) or
 * Android's photo picker (no storage permission). Large photos are resized to 2400 px.
 */
import { Asset, ImagePickerResponse, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { Linking, Platform } from 'react-native';
import Alert from '../i18n/Alert';
import { stripScheme } from '../store/files';
import { remote } from '../remote/remote';

/**
 * App 1.2 (iPhone): before iOS asks for the camera the first time, Fileora says why (Apple shows
 * its question only once; a "no" can only be changed in Settings). Android needs no camera
 * permission (camera app / Google's scanner), so nothing is asked there.
 * Resolves false when the person chooses "Not now".
 */
export function explainCamera(): Promise<boolean> {
  if (Platform.OS !== 'ios' || remote.prefs().cameraExplained) return Promise.resolve(true);
  return new Promise(resolve => {
    Alert.alert(
      'Fileora needs the camera to scan',
      'The scanner takes pictures of your pages and straightens them. Your iPhone asks for permission next. Photos stay on your iPhone unless you choose an online tool.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Continue',
          onPress: () => {
            remote.setPrefs({ cameraExplained: true });
            resolve(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** The camera was refused earlier: only the phone's Settings can change that now. */
function cameraBlocked() {
  Alert.alert(
    'Camera access is off',
    Platform.OS === 'ios' ? 'Turn on Camera for Fileora in Settings to scan.' : 'Allow the camera for Fileora in Android Settings → Apps → Fileora to scan.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
    ],
  );
}

/** cropped: the page was found and straightened by the phone's document scanner */
export type Img = { path: string; width: number; height: number; mime: string; size: number; name: string; cropped?: boolean };
const MAX = 2400;

function toImgs(r: ImagePickerResponse): Img[] {
  if (r.didCancel) return [];
  if (r.errorCode) {
    const msg =
      r.errorCode === 'camera_unavailable'
        ? 'No camera app was found on this phone.'
        : r.errorCode === 'permission'
          ? 'Fileora isn’t allowed to use the camera. You can change this in Android Settings → Apps → Fileora.'
          : r.errorMessage || 'The photo couldn’t be opened.';
    throw new Error(msg);
  }
  return (r.assets ?? [])
    .filter((a: Asset) => !!a.uri)
    .map((a: Asset) => ({
      path: stripScheme(a.uri!),
      width: a.width ?? 0,
      height: a.height ?? 0,
      mime: a.type ?? 'image/jpeg',
      size: a.fileSize ?? 0,
      name: a.fileName ?? 'photo.jpg',
    }));
}

/**
 * Auto Detect (app 1.0): the phone's own document scanner — Google ML Kit on Android, VisionKit on
 * iPhone. While the camera is open it finds the page edges live (also on a tilted page or a busy
 * background), takes the picture when the page is steady, straightens it and crops it. Several
 * pages in a row are possible. No camera permission is needed on Android.
 * Returns [] when the person cancels, null when the scanner isn't available on this phone (no
 * Google Play services, an old iPhone): the camera app is used then, with Fileora's own detection.
 */
export async function scanDocuments(): Promise<Img[] | null> {
  if (!(await explainCamera())) return [];
  try {
    const r = await DocumentScanner.scanDocument({ croppedImageQuality: 92 });
    if (!r || r.status === 'cancel' || !r.scannedImages?.length) return [];
    return r.scannedImages.map((uri, i) => ({ path: stripScheme(uri), width: 0, height: 0, mime: 'image/jpeg', size: 0, name: `scan-${i + 1}.jpg`, cropped: true }));
  } catch (e) {
    console.warn('document scanner not available', e);
    return null;
  }
}

export async function takePhoto(): Promise<Img[]> {
  if (!(await explainCamera())) return [];
  const r = await launchCamera({ mediaType: 'photo', maxWidth: MAX, maxHeight: MAX, quality: 0.9, saveToPhotos: false, cameraType: 'back' });
  if (r.errorCode === 'permission') {
    cameraBlocked();
    return [];
  }
  return toImgs(r);
}

export async function pickPhotos(limit = 0): Promise<Img[]> {
  return toImgs(await launchImageLibrary({ mediaType: 'photo', selectionLimit: limit, maxWidth: MAX, maxHeight: MAX, quality: 0.9 }));
}
