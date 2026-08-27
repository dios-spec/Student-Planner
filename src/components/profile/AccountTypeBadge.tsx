import { BadgeCheck, CircleUserRound } from 'lucide-react';
import type { AccountType } from '../../firebase/accountLinking';

export function accountTypeFromProfile(profile: unknown): AccountType {
  if (
    profile &&
    typeof profile === 'object' &&
    'accountType' in profile
  ) {
    const accountType = (profile as { accountType?: unknown }).accountType;
    if (accountType === 'google') return 'google';
    if (accountType === 'email') return 'email';
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
  const secured = accountType !== 'anonymous';

  const label =
    accountType === 'google'
      ? 'Google linked'
      : accountType === 'email'
        ? 'Email linked'
        : 'Anonymous';

  const title =
    accountType === 'google'
      ? 'Google-linked account'
      : accountType === 'email'
        ? 'Email/password-linked account'
        : 'Anonymous Firebase account';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold ${
        secured
          ? 'border-success/30 bg-success-soft text-success'
          : 'border-line bg-surface-alt text-ink-soft'
      } ${className}`}
      title={title}
    >
      {secured ? (
        <BadgeCheck size={12} aria-hidden="true" />
      ) : (
        <CircleUserRound size={12} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
