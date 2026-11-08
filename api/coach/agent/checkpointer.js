import { BaseCheckpointSaver, WRITES_IDX_MAP } from '@langchain/langgraph-checkpoint';

export class NodeSqliteSaver extends BaseCheckpointSaver {
  constructor(db, serde) {
    super(serde);
    this.db = db;
  }

  async getTuple(config) {
    const { thread_id, checkpoint_ns = '', checkpoint_id } = config.configurable || {};
    const row = checkpoint_id
      ? this.db.prepare('SELECT * FROM checkpoints WHERE thread_id=? AND checkpoint_ns=? AND checkpoint_id=?').get(thread_id, checkpoint_ns, checkpoint_id)
      : this.db.prepare('SELECT * FROM checkpoints WHERE thread_id=? AND checkpoint_ns=? ORDER BY checkpoint_id DESC LIMIT 1').get(thread_id, checkpoint_ns);
    if (!row) return undefined;
    return this.tuple(row);
  }

  async tuple(row) {
    const configurable = { thread_id: row.thread_id, checkpoint_ns: row.checkpoint_ns, checkpoint_id: row.checkpoint_id };
    const pendingWrites = [];
    for (const w of this.db.prepare('SELECT * FROM writes WHERE thread_id=? AND checkpoint_ns=? AND checkpoint_id=? ORDER BY task_id,idx').all(row.thread_id, row.checkpoint_ns, row.checkpoint_id)) {
      pendingWrites.push([w.task_id, w.channel, await this.serde.loadsTyped(w.type, w.value)]);
    }
    return {
      config: { configurable },
      checkpoint: await this.serde.loadsTyped(row.type, row.checkpoint),
      metadata: await this.serde.loadsTyped(row.metadata_type ?? 'json', row.metadata),
      parentConfig: row.parent_checkpoint_id ? { configurable: { ...configurable, checkpoint_id: row.parent_checkpoint_id } } : undefined,
      pendingWrites
    };
  }

  async *list(config, { filter, before, limit } = {}) {
    const clauses = [];
    const params = [];
    for (const key of ['thread_id', 'checkpoint_ns', 'checkpoint_id']) {
      if (config?.configurable?.[key] !== undefined) {
        clauses.push(`${key}=?`);
        params.push(config.configurable[key]);
      }
    }
    if (before?.configurable?.checkpoint_id) {
      clauses.push('checkpoint_id < ?');
      params.push(before.configurable.checkpoint_id);
    }
    let sql = 'SELECT * FROM checkpoints' + (clauses.length ? ' WHERE ' + clauses.join(' AND ') : '') + ' ORDER BY checkpoint_id DESC';
    if (!filter && limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(Math.max(0, limit));
    }
    let count = 0;
    for (const row of this.db.prepare(sql).all(...params)) {
      const tuple = await this.tuple(row);
      if (filter && Object.entries(filter).some(([k, v]) => JSON.stringify(tuple.metadata?.[k]) !== JSON.stringify(v))) continue;
      if (limit !== undefined && count >= limit) break;
      count++;
      yield tuple;
    }
  }

  async put(config, checkpoint, metadata) {
    const { thread_id, checkpoint_ns = '', checkpoint_id } = config.configurable;
    const [type, data] = await this.serde.dumpsTyped(checkpoint);
    const [metadataType, meta] = await this.serde.dumpsTyped(metadata);
    this.db.prepare('INSERT OR REPLACE INTO checkpoints (thread_id,checkpoint_ns,checkpoint_id,parent_checkpoint_id,type,checkpoint,metadata,metadata_type) VALUES(?,?,?,?,?,?,?,?)').run(thread_id, checkpoint_ns, checkpoint.id, checkpoint_id || null, type, data, meta, metadataType);
    return { configurable: { thread_id, checkpoint_ns, checkpoint_id: checkpoint.id } };
  }

  async putWrites(config, writes, taskId) {
    const { thread_id, checkpoint_ns = '', checkpoint_id } = config.configurable;
    const encoded = await Promise.all(writes.map(async ([channel, value], i) => {
      const [type, data] = await this.serde.dumpsTyped(value);
      return [thread_id, checkpoint_ns, checkpoint_id, taskId, WRITES_IDX_MAP[channel] ?? i, channel, type, data];
    }));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const values of encoded) {
        const mode = values[4] < 0 ? 'REPLACE' : 'IGNORE';
        this.db.prepare(`INSERT OR ${mode} INTO writes VALUES(?,?,?,?,?,?,?,?)`).run(...values);
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  async deleteThread(threadId) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM writes WHERE thread_id=?').run(threadId);
      this.db.prepare('DELETE FROM checkpoints WHERE thread_id=?').run(threadId);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}

export function createCheckpointer(db) { return new NodeSqliteSaver(db); }
