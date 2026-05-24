import { Capacitor } from '@capacitor/core';

// Web fallback: open a file picker (camera on mobile browsers via `capture`).
function fileInputCapture(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'user');
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        reject(new Error('capture cancelled'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    };
    document.body.appendChild(input);
    input.click();
  });
}

export function isWebPlatform(): boolean {
  return Capacitor.getPlatform() === 'web';
}

/** Native (Capacitor) camera capture → data URL. */
export async function captureNativePhoto(): Promise<string> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 70,
    width: 1024,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    allowEditing: false,
  });
  if (!photo.base64String) throw new Error('capture failed');
  return `data:image/${photo.format || 'jpeg'};base64,${photo.base64String}`;
}

/** Open the front-facing camera as a live stream (web viewfinder). */
export function startCameraStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
    audio: false,
  });
}

/** Snapshot the current video frame to a JPEG data URL. */
export function grabFrame(video: HTMLVideoElement): string {
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 960;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/** Capture a photo and return it as a `data:image/...;base64,` URL. */
export async function capturePhoto(): Promise<string> {
  return isWebPlatform() ? fileInputCapture() : captureNativePhoto();
}

export async function requestCameraPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() === 'web') return true;
  try {
    const { Camera } = await import('@capacitor/camera');
    const res = await Camera.requestPermissions({ permissions: ['camera'] });
    return res.camera === 'granted' || res.camera === 'limited';
  } catch {
    return false;
  }
}
