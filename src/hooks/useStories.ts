import { useMemo } from 'react';
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

  const groups = useMemo<StoryGroup[]>(() => {
    const next: StoryGroup[] = [];
    if (!stories) return next;
    const byAuthor = new Map<string, StoryGroup>();
    [...stories].reverse().forEach((story) => {
      let group = byAuthor.get(story.authorId);
      if (!group) {
        group = {
          authorId: story.authorId,
          authorName: story.authorName,
          authorAvatar: story.authorAvatar,
          stories: [],
        };
        byAuthor.set(story.authorId, group);
        next.push(group);
      }
      group.stories.push(story);
    });
    return next;
  }, [stories]);

  return { stories, groups, loading };
}
