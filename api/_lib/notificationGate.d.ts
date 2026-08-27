/**
 * Types for the server notification gate, so the cross-check unit test in
 * src/utils/notificationGate.test.ts can import the REAL server module rather
 * than a copy of it.
 */
export interface QuietHours {
  enabled?: boolean;
  start?: string;
  end?: string;
  allowCalls?: boolean;
  allowUrgent?: boolean;
}

export interface GateUser {
  notificationSettings?: ({ quietHours?: QuietHours | null } & Record<string, unknown>) | null;
  timezone?: string;
}

export function categoryForType(type: string): string | null;
export function isCategoryEnabled(settings: unknown, category: string | null): boolean;
export function isUrgentType(type: string): boolean;
export function isWithinQuietHours(
  now: Date,
  tz: string | undefined,
  start: string | undefined,
  end: string | undefined
): boolean;
export function checkPushAllowed(
  user: GateUser,
  notifType: string
): { allowed: boolean; reason?: string };
