import { maskIp } from "./network";
import type { DeviceRow } from "@/components/devices/DeviceList";

export interface DeviceDbRow {
  id: string;
  device_id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  ip_address: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export const DEVICE_COLUMNS = "id, device_id, device_name, browser, os, location, ip_address, first_seen_at, last_seen_at, is_active, revoked_at, revoked_reason";

/** Клиентке тек қажетті өрістер: IP жасырылады, device_id жіберілмейді */
export function toDeviceRow(r: DeviceDbRow, currentDeviceId: string | null): DeviceRow {
  return {
    id: r.id,
    device_name: r.device_name,
    browser: r.browser,
    os: r.os,
    location: r.location,
    masked_ip: maskIp(r.ip_address),
    first_seen_at: r.first_seen_at,
    last_seen_at: r.last_seen_at,
    is_active: r.is_active,
    revoked_at: r.revoked_at,
    revoked_reason: r.revoked_reason,
    is_current: !!currentDeviceId && r.device_id === currentDeviceId && r.is_active,
  };
}
