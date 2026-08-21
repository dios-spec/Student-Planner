import { watchActiveStories } from '../firebase/stories';
import { useCachedSnapshot } from './useCachedSnapshot';
import type { Story } from '../types';

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  stories: Story[];
}

export function useStories() {
  const { data: stories, loading } = useCachedSnapshot<Story[]>('stories', watchActiveStories);

  const groups: StoryGroup[] = [];
  if (stories) {
    const byAuthor = new Map<string, StoryGroup>();
    [...stories].reverse().forEach((s) => {
      let g = byAuthor.get(s.authorId);
      if (!g) {
        g = { authorId: s.authorId, authorName: s.authorName, authorAvatar: s.authorAvatar, stories: [] };
        byAuthor.set(s.authorId, g);
        groups.push(g);
      }
      g.stories.push(s);
    });
  }

  return { stories, groups, loading };
}
