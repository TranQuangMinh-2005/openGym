import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ChangeSchema, readLedger, stageChanges } from '../ledger.js';
import { insertDraft } from '../db.js';

export const get_constraints = {
  name: 'get_constraints',
  description: 'Read confirmed constraints before planning. Optionally include pending entries or the full ledger history. Returns ledger entries without modifying state.',
  schema: z.object({ includePending: z.boolean().optional(), includeHistory: z.boolean().optional() }),
  async run(args, ctx) {
    const a = get_constraints.schema.parse(args);
    return [...readLedger(await ctx.readState(ctx.uid)), ...(a.includePending ? ctx.pendingConstraints || [] : [])].filter(e => a.includeHistory || e.status === 'active' || (a.includePending && e.status === 'pending'));
  }
};
export const update_constraints = {
  name: 'update_constraints',
  description: 'Stage explicit user constraints for approval. Returns a draft id, pending entries, and direct conflicts. Never changes user state; confirmation is required.',
  schema: z.object({ changes: z.array(ChangeSchema).min(1) }),
  async run(args, ctx) {
    const { changes } = update_constraints.schema.parse(args);
    const S = await ctx.readState(ctx.uid);
    const staged = stageChanges(S, changes, { now: ctx.now });
    const draftId = randomUUID();
    const diff = staged.entries.map(e => ({ before: readLedger(S).find(old => old.id === e.supersedes) || null, after: e }));
    insertDraft({ id: draftId, uid: ctx.uid, kind: 'constraints', payload: { entries: staged.entries, summary: staged.entries.map(e => { const labels = { avoid_region: 'Tránh vùng', avoid_exercise: 'Tránh bài', avoid_equipment: 'Tránh thiết bị', max_session_minutes: 'Thời lượng tối đa', days_per_week: 'Số buổi mỗi tuần', available_equipment: 'Thiết bị', goal: 'Mục tiêu', experience: 'Kinh nghiệm' }; const regions = { shoulder: 'vai', back: 'lưng', knee: 'gối', wrist: 'cổ tay', elbow: 'khuỷu tay', hip: 'hông', ankle: 'cổ chân', neck: 'cổ', chest: 'ngực' }; return `${labels[e.type] ?? e.type}: ${Object.values(e.value).flat().map(v => e.type === 'avoid_region' ? regions[v] ?? v : v).join(', ')}`; }).join('; ') }, diff, base_rev: S._rev });
    return { draftId, ...staged, needsConfirmation: true };
  }
};
