import Modal from '../shared/Modal';
import Avatar from '../shared/Avatar';
import type { StudentProfile } from '../../types';
import RoleBadge from './RoleBadge';
import { isVerifiedTeacherProfile } from '../../utils/roles';

export default function ProfileCard({
  profile,
  onClose,
}: {
  profile: StudentProfile | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!profile} onClose={onClose} title="Profile">
      {profile && (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <Avatar name={profile.displayName} src={profile.avatarUrl} emoji={profile.emoji} size="lg" />
          <div>
            <p className="font-display text-lg font-semibold text-ink">{profile.displayName}</p>
            <div className="mt-1 flex justify-center">
              <RoleBadge teacher={isVerifiedTeacherProfile(profile)} />
            </div>
          </div>
          {profile.bio && <p className="text-sm italic text-ink-soft">"{profile.bio}"</p>}
        </div>
      )}
    </Modal>
  );
}
