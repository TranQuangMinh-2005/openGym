import crypto from 'node:crypto';
import { stampPut } from './sync-stamps.js';

// The compare-and-write behind PUT /api/data, as a factory over server.js's own helpers (the
// pattern coach/routes.js uses): importing server.js would start its listener, and taking the
// helpers rather than copies keeps one definition of what a stored entry is and what a client
// is shown. `commitState` is the same write for a server-side writer (the agent Coach's commit).
// How many earlier write ids a document keeps (`_wids`): a device that last synced more writes
// ago than this merges on its next pull instead of taking the server's copy.
const WID_KEEP = 50;
export function createStateStore({ readStateStrict, UNREADABLE, atomicWrite, stateFile, stateCache, records, forClient, onWritten }) {
  function writeState(uid, state, { baseRev, baseWid, stamped } = {}) {
    if (!state || typeof state !== 'object') return { ok: false, status: 400, error: 'state required' };
    // An object with nothing of the profile in it empties the document with the counter left
    // intact: what lands on disk is `{"_rev":n+1}`, every routine, workout and weigh-in gone, and
    // the next poll reports a revision the client accepts as its own. `_rev` and `_ts` do not
    // count towards "something of the profile" — both are bookkeeping this route writes or echoes
    // itself, so `{}` and `{"_rev":5}` are the same push and get the same refusal. Nothing
    // shipped sends either: the web and mobile clients push a state built on DEF
    // (frontend/src/store/useStore.js), which always carries its keys. An array is a document
    // loss of its own and is left to the `invalid state` check below, which already refuses it.
    if (!Array.isArray(state) && !Object.keys(state).some(k => k !== '_rev' && k !== '_ts')) {
      return { ok: false, status: 400, error: 'state required' };
    }
    // The reminder tick and the admin routes iterate these two on the server's side, so a truthy
    // non-array would throw there on every pass for as long as it sat on disk. Absent or null is
    // fine — every client fills its own defaults. An array is `typeof 'object'` but no document:
    // `_rev` set on it is dropped by JSON.stringify, so the file would read back as rev 0 while
    // the response claimed the next revision.
    const list = v => v == null || Array.isArray(v);
    if (Array.isArray(state) || !list(state.workouts) || !list(state.routines)) return { ok: false, status: 400, error: 'invalid state' };
    // The same readers walk every entry (`w.d`, `w.name`). They skip what is not an entry now
    // (`records` above), but nothing should be storing one. Dropped, not refused:
    // such an entry carries nothing worth keeping, whereas a 400 would strand a client whose own
    // copy is already malformed — it keeps re-sending the same document and never syncs again.
    for (const k of ['workouts', 'routines']) if (Array.isArray(state[k])) state[k] = records(state[k]);
    // Conditional write: a `baseRev` that is not the current revision means this client last
    // read an older document — another device has written since — and the copy it is about to
    // push would silently drop that write. The current document travels back with the 409, so
    // the client can merge and try again without a second request. No `baseRev` (a client from
    // before revisions, or a deliberate replace such as a backup import) overwrites, as before.
    // readState and atomicWrite are synchronous with nothing awaited between them, so the
    // compare-and-write is atomic for this process.
    const cur = readStateStrict(uid);
    if (cur === UNREADABLE) { console.error('state file unreadable for', uid); return { ok: false, status: 503, error: 'state unreadable' }; }
    const curRev = cur?._rev || 0;
    // `_rev` is a counter, so after the data directory went back in time (a restored backup, a
    // write lost to a power cut) the same number names a different document. Every write also gets
    // a write id (`_wid`) and keeps its ancestors' (`_wids`): a client quoting the id it last saw
    // (`baseWid`) is refused when the stored document is not that one, whatever the numbers say,
    // and a client reading a document can tell whether it descends from its own (useStore pullState).
    if ((baseRev != null && baseRev !== curRev) ||
        (baseRev != null && typeof baseWid === 'string' && cur?._wid && baseWid !== cur._wid)) {
      return { ok: false, status: 409, error: 'conflict', rev: curRev, state: forClient(cur) };
    }
    delete state.active;              // in-progress workouts stay device-local
    // "Reset everything" stamps the profile (`resetAt`, with `resetIds`: what it wiped). The stamp
    // only moves forward: a write without it, or with an older one — a client from before it, a
    // backup restored over the profile — keeps the stored stamp. Otherwise every device that saw
    // the reset would take that copy for one older than the reset, and wipe it again on its next
    // merge (frontend/src/lib/sync-merge.js).
    const storedReset = Number(cur?.resetAt) || 0;
    if (storedReset > (Number(state.resetAt) || 0)) {
      state.resetAt = cur.resetAt;
      if (cur.resetIds && typeof cur.resetIds === 'object') state.resetIds = cur.resetIds;
      else delete state.resetIds;
    }
    // The records of removals and edits only grow, and what a writer that does not stamp its own
    // changes (an older app, an API script) changed is stamped here, so it is neither wiped nor
    // undone by the next device that merges (sync-stamps.js).
    // A document nested too deep to compare is the bad request the stringify below refuses too.
    const report = {};
    try { stampPut(cur, state, { overRead: baseRev != null && baseRev === curRev, stamped: stamped === true, report }); }
    catch (e) { if (e instanceof RangeError) return { ok: false, status: 400, error: 'invalid state' }; throw e; }
    state._rev = curRev + 1;          // server-owned; whatever the client sent is ignored
    // A writer that does not stamp (an older app) takes the revision it is told for the document it
    // sent, and only reads the profile again once the revision moves. When the server put back
    // something it left out or set back (sync-stamps.js), the document stored is not that one: it
    // goes in one revision further, so the writer's next check of the revision (every half minute)
    // finds it moved and reads it, and its next push over the one it was told is a conflict to merge.
    if (report.changed) state._rev = curRev + 2;
    state._wids = [...(Array.isArray(cur?._wids) ? cur._wids : []), ...(cur?._wid ? [cur._wid] : [])]
      .filter(x => typeof x === 'string').slice(-WID_KEEP);
    state._wid = crypto.randomBytes(8).toString('hex');
    // JSON.parse takes any nesting, JSON.stringify recurses and runs out of stack on a document
    // nested some thousands deep. No client builds one; it is a bad request, not a server error.
    let text;
    try { text = JSON.stringify(state); }
    catch (e) { if (e instanceof RangeError) return { ok: false, status: 400, error: 'invalid state' }; throw e; }
    atomicWrite(stateFile(uid), text);
    // The stat cache cannot see this write on its own: mtime granularity is 4 ms here (ext4 on
    // this kernel — 3901 of 3999 back-to-back same-size writes shared one timestamp), and a
    // `_rev` going from 7 to 8 does not change the file's size, so two writes inside one 4 ms
    // tick are the same (mtimeMs, size) key. A reader that sampled between them would then serve
    // the old revision until some later write happened to land on a different tick. This is the
    // only writer of a state file in the tree, so evicting here is the whole fix.
    stateCache.delete(uid);
    // Starts (or stops) the grace clock of every stored file this write stopped (or started)
    // referencing. Bookkeeping only: the state is already saved, so nothing here may turn a
    // successful write into an error.
    try { onWritten?.(uid, state); } catch (e) { console.error('media noteState', e); }
    return { ok: true, ts: state._ts || null, rev: curRev + 1, wid: state._wid };
  }
  function commitState(uid, mutate, { expectRev } = {}) {
    // No await may split this read/mutate/write: the revision comparison is atomic in-process.
    const current = readStateStrict(uid);
    if (current === UNREADABLE) return { ok: false, status: 503, error: 'state unreadable' };
    // A profile that never synced has no document yet; its first server-side write (an approved
    // first plan) starts one, the same as a first PUT does.
    const rev = current?._rev || 0;
    if (expectRev !== undefined && expectRev !== rev) return { ok: false, status: 409, error: 'conflict', rev, state: forClient(current) };
    const clone = current == null ? {} : structuredClone(current);
    mutate(clone);
    return writeState(uid, clone, { baseRev: rev, stamped: false });
  }
  return { writeState, commitState };
}
