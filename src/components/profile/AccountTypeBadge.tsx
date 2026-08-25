import { BadgeCheck, CircleUserRound } from 'lucide-react';
import type { AccountType } from '../../firebase/accountLinking';

export function accountTypeFromProfile(profile: unknown): AccountType {
  if (
    profile &&
    typeof profile === 'object' &&
    'accountType' in profile &&
    (profile as { accountType?: unknown }).accountType === 'google'
  ) {
    return 'google';
  }
  return 'anonymous';
}

export default function AccountTypeBadge({
  accountType,
  className = '',
}: {
  accountType: AccountType;
  className?: string;
}) {
  const google = accountType === 'google';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        google
          ? 'border-success/30 bg-success-soft text-success'
          : 'border-line bg-surface-alt text-ink-soft'
      } ${className}`}
      title={google ? 'Google-linked account' : 'Anonymous Firebase account'}
    >
      {google ? (
        <BadgeCheck size={12} aria-hidden="true" />
      ) : (
        <CircleUserRound size={12} aria-hidden="true" />
      )}
      {google ? 'Google linked' : 'Anonymous'}
    </span>
  );
}
