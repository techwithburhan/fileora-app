/**
 * Photos for the scanner: the phone's own camera app (so Fileora needs no camera permission) or
 * Android's photo picker (no storage permission). Large photos are resized to 2400 px.
 */
import { Asset, ImagePickerResponse, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { stripScheme } from '../store/files';

export type Img = { path: string; width: number; height: number; mime: string; size: number; name: string };
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

export async function takePhoto(): Promise<Img[]> {
  return toImgs(await launchCamera({ mediaType: 'photo', maxWidth: MAX, maxHeight: MAX, quality: 0.9, saveToPhotos: false, cameraType: 'back' }));
}

export async function pickPhotos(limit = 0): Promise<Img[]> {
  return toImgs(await launchImageLibrary({ mediaType: 'photo', selectionLimit: limit, maxWidth: MAX, maxHeight: MAX, quality: 0.9 }));
}
