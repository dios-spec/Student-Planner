const ADJECTIVES = ['Speedy', 'Clever', 'Sunny', 'Brave', 'Chill', 'Curious', 'Quiet', 'Bright'];
const ANIMALS = ['Fox', 'Owl', 'Panda', 'Tiger', 'Otter', 'Falcon', 'Koala', 'Wolf'];

/** Friendly default name like "Student 247" so nobody has a blank profile. */
export function randomStudentName(): string {
  return `Student ${Math.floor(100 + Math.random() * 900)}`;
}

/** Optional fun alternative kept for future use (e.g. anonymous chat guests). */
export function randomFunName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a} ${b}`;
}

export function defaultAvatarSeed(uid: string): string {
  return uid.slice(0, 8);
}
