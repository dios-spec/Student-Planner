import { useEffect, useMemo, useState } from 'react';
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
  // BUG-14: watchActiveStories freezes "now" into its query at subscribe time,
  // and the cache key never changed -- so stories that expired while the app
  // stayed open remained visible until a full reload. Rolling the key every
  // 5 minutes forces a fresh subscription with a fresh cutoff.
  const [bucket, setBucket] = useState(() => Math.floor(Date.now() / 300_000));
  useEffect(() => {
    const id = window.setInterval(
      () => setBucket(Math.floor(Date.now() / 300_000)),
      60_000
    );
    return () => window.clearInterval(id);
  }, []);

  const { data: stories, loading } = useCachedSnapshot<Story[]>(
    `stories:${bucket}`,
    watchActiveStories
  );

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
