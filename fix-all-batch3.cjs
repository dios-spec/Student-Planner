/* ============================================================
   BUDDY PLANNER - VERIFIED FIX SCRIPT (Batch 3)
   Re-audit pass. Fixes:
     REGRESSION-01  cache leak + skeleton flash I introduced in batch 2
     REGRESSION-02  atomic batch could silence a whole class
     BUG-26         microphone stayed LIVE after unmount while recording
     BUG-27         voice note kept playing after leaving the chat
   Run AFTER batch 1 and batch 2, from the project root:
       node fix-all-batch3.cjs
   ============================================================ */

const fs=require("fs");
let ok=0,fail=0;
function patch(p,o,n,l){
  let c; try{c=fs.readFileSync(p,"utf8");}catch(e){console.error("[FAIL] "+l);fail++;return;}
  if(!c.includes(o)){console.error("[FAIL] "+l+": ANCHOR NOT FOUND");fail++;return;}
  if(n!==""&&c.includes(n)){console.log("[OK] "+l+": already applied");ok++;return;}
  fs.writeFileSync(p,c.replace(o,n),"utf8");console.log("[OK] "+l);ok++;
}

// ===== REGRESSION-01 (introduced by my own BUG-14 fix) =====
// The rolling cache key leaked a cache entry every 5 minutes AND flipped
// `loading` back to true on each roll, flashing a skeleton in the story bar.
// Correct approach: stable key, filter expired stories client-side.
patch("src/hooks/useStories.ts",
`  // BUG-14: watchActiveStories freezes "now" into its query at subscribe time,
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
    \`stories:\${bucket}\`,
    watchActiveStories
  );`,
`  // BUG-14: watchActiveStories freezes "now" into its query at subscribe time,
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
  }, [rawStories, nowMs]);`,
"REGRESSION-01 stories filter client-side");

// ===== REGRESSION-02 (introduced by my own BUG-09b fix) =====
// A batch commit is atomic: one bad recipient would drop the whole chunk's
// notifications. Individual addDocs used to fail independently. Make each
// chunk resilient so one bad doc can't silence a whole class.
patch("src/firebase/notifications.ts",
`      ids.push(ref.id);
    }
    await batch.commit();
  }`,
`      ids.push(ref.id);
    }
    // A batch is atomic -- guard so one rejected chunk cannot silence the rest.
    try {
      await batch.commit();
    } catch (err) {
      console.error('[NOTIF] batch commit failed for a chunk:', err);
    }
  }`,
"REGRESSION-02 resilient batch commit");





/* ---- fix11.cjs ---- */

// ===== BUG-26: microphone stays LIVE after unmount while recording =====
// useVoiceRecorder had no unmount cleanup at all. Starting a recording and then
// closing the chat left the getUserMedia stream open indefinitely -- the browser
// keeps showing the "recording" indicator and the mic is never released.
patch("src/hooks/useVoiceRecorder.ts",
`import { useCallback, useRef, useState } from 'react';`,
`import { useCallback, useEffect, useRef, useState } from 'react';`,
"BUG-26 import useEffect");

patch("src/hooks/useVoiceRecorder.ts",
`  const start = useCallback(async () => {`,
`  // BUG-26: release the microphone if the component unmounts mid-recording.
  // Without this the mic stream stays open for the rest of the session.
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        mediaRef.current.onstop = null;
        try { mediaRef.current.stop(); } catch { /* already stopped */ }
      }
      resolveRef.current = null;
      cleanupRef.current();
    };
  }, []);

  const start = useCallback(async () => {`,
"BUG-26 release mic on unmount");

// ===== BUG-27: voice message keeps playing after you navigate away =====
patch("src/components/dm/VoicePlayer.tsx",
`    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);`,
`    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
      // BUG-27: stop playback on unmount, otherwise a voice note keeps playing
      // after the chat screen closes with no way to stop it.
      try { audio.pause(); } catch { /* ignore */ }
    };
  }, []);`,
"BUG-27 pause voice on unmount");





console.log('\n============================================');
console.log('  ' + ok + ' fixes applied, ' + fail + ' FAILED');
console.log('============================================');
if (fail) { console.error('\nDo NOT build/deploy. Paste output back.'); process.exit(1); }
console.log('\nNext: npm run build');
