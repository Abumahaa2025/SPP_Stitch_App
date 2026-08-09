/**
 * Live photo/video capture for portal desks (tenant/tech/agent/guard).
 * Prefers camera capture; falls back to library/document picker.
 * Web uses capture=environment so WhatsApp/PWA links open the phone camera.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export type CapturedPortalMedia = {
  uri: string;
  kind: 'photo' | 'video';
  name?: string;
};

async function pickFromDocuments(kind: 'photo' | 'video'): Promise<CapturedPortalMedia | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: kind === 'photo' ? ['image/*'] : ['video/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  return { uri: asset.uri, kind, name: asset.name };
}

function captureViaHtmlInput(kind: 'photo' | 'video'): Promise<CapturedPortalMedia | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'photo' ? 'image/*' : 'video/*';
    // Force camera on mobile browsers (PWA / WhatsApp in-app browser).
    input.setAttribute('capture', kind === 'photo' ? 'environment' : 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    let settled = false;
    const finish = (value: CapturedPortalMedia | null) => {
      if (settled) return;
      settled = true;
      try { document.body.removeChild(input); } catch { /* ignore */ }
      resolve(value);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      const uri = URL.createObjectURL(file);
      finish({
        uri,
        kind,
        name: file.name || (kind === 'photo' ? 'capture.jpg' : 'capture.mp4'),
      });
    };
    // Some browsers cancel without onchange — recover on focus return.
    const onFocus = () => {
      setTimeout(() => {
        if (!settled && !input.files?.length) finish(null);
        window.removeEventListener('focus', onFocus);
      }, 800);
    };
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

async function captureViaImagePicker(kind: 'photo' | 'video'): Promise<CapturedPortalMedia | null> {
  // Dynamic require so older native binaries without the module can fall back.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const perm = kind === 'photo'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    // Library as secondary path when camera permission denied.
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!lib.granted) return pickFromDocuments(kind);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'photo'
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
      videoMaxDuration: 120,
    });
    if (picked.canceled || !picked.assets?.[0]) return null;
    const a = picked.assets[0];
    return {
      uri: a.uri,
      kind,
      name: a.fileName || (kind === 'photo' ? 'photo.jpg' : 'video.mp4'),
    };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: kind === 'photo'
      ? ImagePicker.MediaTypeOptions.Images
      : ImagePicker.MediaTypeOptions.Videos,
    quality: 0.85,
    videoMaxDuration: 120,
    cameraType: ImagePicker.CameraType.back,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    kind,
    name: a.fileName || (kind === 'photo' ? 'photo.jpg' : 'video.mp4'),
  };
}

/** Capture live photo/video for portal desks. */
export async function capturePortalMedia(kind: 'photo' | 'video'): Promise<CapturedPortalMedia | null> {
  if (Platform.OS === 'web') {
    try {
      const live = await captureViaHtmlInput(kind);
      if (live) return live;
    } catch { /* fall through */ }
    return pickFromDocuments(kind);
  }

  try {
    const live = await captureViaImagePicker(kind);
    if (live) return live;
  } catch {
    // Native module missing / camera unavailable — gallery/document fallback.
  }
  return pickFromDocuments(kind);
}
