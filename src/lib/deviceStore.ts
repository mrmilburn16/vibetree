export interface RegisteredDevice {
  deviceToken: string;
  activityPushToken?: string;
  registeredAt: number;
}

const g = globalThis as unknown as { __registeredDevices?: Map<string, RegisteredDevice> };
if (!g.__registeredDevices) g.__registeredDevices = new Map();
const devices = g.__registeredDevices;

export function registerDevice(deviceToken: string, activityPushToken?: string): void {
  devices.set(deviceToken, {
    deviceToken,
    activityPushToken,
    registeredAt: Date.now(),
  });
}

export function getAllDevices(): RegisteredDevice[] {
  return Array.from(devices.values());
}

export function removeDevice(deviceToken: string): void {
  devices.delete(deviceToken);
}
