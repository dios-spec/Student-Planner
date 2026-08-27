/**
 * Single source of truth for "may these two people interact?".
 *
 * This mirrors, one-for-one, the `notBlockedWith` / `dmPeerOf` /
 * `dmChannelOpen` helpers in firestore.rules. The RULES are the enforcement;
 * this module exists so the UI reaches the same verdict and does not offer an
 * action the server will reject. Keep the two in step: if the truth table here
 * changes, firestore.rules must change with it.
 */

export type InteractionState = 'loading' | 'blocked' | 'open';

/**
 * The other participant in a 1:1 conversation.
 *
 * Derived from memberIds rather than by parsing the conversation id. The id
 * happens to be `sorted(a,b).join('__')` today, but memberIds is the field the
 * security rules read, and it stays correct for any conversation however its
 * id was formed. Returns null when this is not a well-formed 2-person DM.
 */
export function dmPeerOf(memberIds: readonly string[] | undefined, myUid: string): string | null {
  if (!memberIds || memberIds.length !== 2) return null;
  if (memberIds[0] === myUid) return memberIds[1];
  if (memberIds[1] === myUid) return memberIds[0];
  return null;
}

/**
 * Blocking is symmetric for the purpose of sending: if I blocked them, or they
 * blocked me, the channel is closed for me in both cases.
 */
export function isBlockedPair(
  peerUid: string,
  iBlocked: ReadonlySet<string>,
  blockedMe: ReadonlySet<string>
): boolean {
  return iBlocked.has(peerUid) || blockedMe.has(peerUid);
}

/**
 * Three-state answer, so callers can distinguish "definitely blocked" from
 * "we do not know yet".
 *
 * The old code initialised both block sets to empty and exposed a plain
 * boolean, so `cannotInteract` returned false for the first render(s) after
 * mount -- the composer was live and a blocked message was sendable during
 * that window. Callers must now treat 'loading' as not-yet-sendable.
 */
export function interactionStateFor(
  peerUid: string | null | undefined,
  loaded: boolean,
  iBlocked: ReadonlySet<string>,
  blockedMe: ReadonlySet<string>
): InteractionState {
  if (!peerUid) return 'open';
  if (!loaded) return 'loading';
  return isBlockedPair(peerUid, iBlocked, blockedMe) ? 'blocked' : 'open';
}
