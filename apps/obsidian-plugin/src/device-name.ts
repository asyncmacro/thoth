import { Platform } from 'obsidian';

function osFromUA(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/mac/.test(ua)) return 'macOS';
  if (/win/.test(ua)) return 'Windows';
  if (/linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

export function defaultDeviceName(): string {
  if (Platform.isMobileApp) {
    if (Platform.isIosApp) return 'Obsidian · Mobile (iOS)';
    if (Platform.isAndroidApp) return 'Obsidian · Mobile (Android)';
    return `Obsidian · Mobile (${osFromUA()})`;
  }
  if (Platform.isDesktopApp) {
    return `Obsidian · Desktop (${osFromUA()})`;
  }
  return 'Obsidian · Unknown';
}
