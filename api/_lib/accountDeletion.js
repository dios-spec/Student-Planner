/**
 * What "delete my account" actually means for Buddy Planner's schema.
 *
 * The plan is expressed as data so it can be unit tested and reviewed without
 * running a deletion. Every collection the app writes to is accounted for
 * below -- either in a rule here, or in the SPECIAL_CASES / RETAINED notes, so
 * that nothing is silently forgotten.
 *
 * Three dispositions:
 *   delete  - the record is personal and belongs only to this user
 *   redact  - the record is part of someone else's conversation history;
 *             removing it outright would tear holes in other people's threads,
 *             so the content is emptied and the authorship anonymised
 *   retain  - deliberately kept, with a reason (see RETAINED)
 */

/** Firestore hard-caps a batch at 500 operations. */
export const BATCH_LIMIT = 400;

export const DELETION_PLAN = [
  // Device push credentials must go first: whatever else happens, this account
  // must stop being reachable on any device.
  { collection: 'pushDevices', match: 'docId', mode: 'delete', why: 'FCM tokens are device credentials' },

  // Strictly private to the owner.
  { collection: 'personalNotes', match: 'ownerId', mode: 'delete', why: 'private notes' },
  { collection: 'saved', match: 'userId', mode: 'delete', why: 'private bookmarks' },
  { collection: 'reminders', match: 'userId', mode: 'delete', why: 'private reminders' },
  { collection: 'completionStatus', match: 'userId', mode: 'delete', why: 'private task completion' },
  { collection: 'notifications', match: 'userId', mode: 'delete', why: 'own notification inbox' },
  { collection: 'blocks', match: 'blockerId', mode: 'delete', why: 'blocks this user made' },
  { collection: 'blocks', match: 'blockedId', mode: 'delete', why: 'blocks against this user' },

  // Content authored by this user.
  { collection: 'posts', match: 'authorId', mode: 'delete', why: 'own posts' },
  { collection: 'reels', match: 'authorId', mode: 'delete', why: 'own reels' },
  { collection: 'stories', match: 'authorId', mode: 'delete', why: 'own stories' },
  { collection: 'comments', match: 'authorId', mode: 'delete', why: 'own comments' },

  // Conversation history belonging to other people too.
  { collection: 'messages', match: 'senderId', mode: 'redact', why: 'class chat history stays readable' },
  { collection: 'teacherMessages', match: 'senderId', mode: 'redact', why: 'teacher chat history stays readable' },
];

/** Handled by dedicated code rather than a generic query. */
export const SPECIAL_CASES = [
  'users',                    // anonymised, not deleted, so old references still render
  'conversations',            // membership removed / DM member entry anonymised
  'conversations/*/messages', // redacted per conversation
  'firebase-auth',            // the identity itself, deleted last
];

/**
 * Deliberately kept. Each of these is a HUMAN POLICY DECISION, not a technical
 * one, and the endpoint does not touch them.
 */
export const RETAINED = [
  {
    collection: 'meritRecords',
    why: 'School disciplinary and merit records. Whether a student may erase '
      + 'their own merit history is a school policy and data-protection question, '
      + 'not an engineering one. The linked profile is anonymised, so these '
      + 'display as "Deleted user".',
  },
  {
    collection: 'reports',
    why: 'Moderation records. Deleting them on request would let a reported '
      + 'user erase the evidence against them.',
  },
  {
    collection: 'plannerItems',
    why: 'Class-shared homework and exams that other students depend on. Holds '
      + 'a createdBy uid but no personal content.',
  },
  {
    collection: 'announcements/studyMaterials/timetable',
    why: 'Teacher-authored class resources shared with the whole class.',
  },
  {
    collection: 'calls',
    why: 'Short-lived call state. A finished call doc holds the uid in memberIds '
      + 'and participants but no content, and callers cannot read a call they '
      + 'were not a member of. Left alone deliberately: rewriting historical call '
      + 'documents risks corrupting a call that is still live for someone else.',
  },
  {
    collection: 'appMeta',
    why: 'Shared class-chat pins and typing indicators. Typing entries expire on '
      + 'their own within seconds; pinned entries are class-shared content whose '
      + 'author label resolves through the anonymised profile.',
  },
  {
    collection: 'cloudinary-media',
    why: 'Uploaded images, video and voice notes. Uploads are UNSIGNED, so the '
      + 'server holds no API secret able to delete them. Requires CLOUDINARY_API_KEY '
      + 'and CLOUDINARY_API_SECRET before this can be automated.',
  },
];

/** Fields wiped from the public profile. The document itself stays. */
export function anonymisedProfile(deleteMarker) {
  return {
    displayName: 'Deleted user',
    bio: '',
    avatarUrl: '',
    emoji: '',
    mood: '',
    classId: '',
    onboarded: false,
    accountType: 'deleted',
    deletedAt: deleteMarker,
  };
}

/** Patch applied to a message that is redacted rather than removed. */
export function redactedMessage(deleteField) {
  return {
    deleted: true,
    text: '',
    imageUrl: '',
    audioUrl: '',
    senderName: 'Deleted user',
    senderAvatar: deleteField,
  };
}

/**
 * Membership arithmetic for a group the leaving user was in.
 *
 * A group must not be left without an admin, and must not be left with a
 * dangling reference to a deleted account.
 */
export function nextGroupMembership(memberIds, adminIds, uid) {
  const members = (memberIds || []).filter((id) => id !== uid);
  let admins = (adminIds || []).filter((id) => id !== uid);

  // Removing the last admin would leave the group unmanageable, so hand it to
  // the longest-standing remaining member.
  if (!admins.length && members.length) admins = [members[0]];

  return { memberIds: members, adminIds: admins, empty: members.length === 0 };
}

/** Split ids into Firestore-batch-sized chunks. */
export function chunk(items, size = BATCH_LIMIT) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
