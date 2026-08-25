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
  // so stories that expire while the app stays open used to linger until a
  // reload. Rolling the CACHE KEY was the wrong fix (it leaked a cache entry
  // per interval and re-flashed the loading skeleton). Instead: keep one stable
  // subscription and drop expired stories on the client, re-evaluated on a tick.
  const { data: rawStories, loading } = useCachedSnapshot<Story[]>(
    'stories',
    watchActiveStories
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const stories = useMemo(() => {
    if (!rawStories) return rawStories;
    return rawStories.filter((s) => {
      const exp = s.expiresAt?.toMillis?.();
      return exp === undefined || exp > nowMs;
    });
  }, [rawStories, nowMs]);

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
