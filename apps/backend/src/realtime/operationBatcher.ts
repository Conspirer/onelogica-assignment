type PersistedOperation = {
  opId: string;
  timestamp: string;
  payload: unknown;
};

type OperationRecord = {
  diagramId: string;
  actorId: string;
  operation: PersistedOperation;
};

type QueryFn = (sql: string, params: unknown[]) => Promise<unknown>;

type OperationBatcherOptions = {
  flushIntervalMs?: number;
  maxBatchSize?: number;
};

export type OperationBatcher = {
  queueOperation: (record: OperationRecord) => Promise<void>;
  flushAll: () => Promise<void>;
  stop: () => Promise<void>;
};

const DEFAULT_FLUSH_INTERVAL_MS = 1500;
const DEFAULT_MAX_BATCH_SIZE = 30;

function queueKey(diagramId: string, actorId: string) {
  return `${diagramId}:${actorId}`;
}

export function createOperationBatcher(
  query: QueryFn,
  options: OperationBatcherOptions = {},
): OperationBatcher {
  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
  const pending = new Map<string, PersistedOperation[]>();

  async function flushKey(key: string): Promise<void> {
    const batch = pending.get(key);
    if (!batch || batch.length === 0) {
      return;
    }

    pending.delete(key);
    const [diagramId, actorId] = key.split(":");

    try {
      await query(
        `
          INSERT INTO diagram_operation_batches (diagram_id, actor_id, operations)
          VALUES ($1::uuid, $2::uuid, $3::jsonb)
        `,
        [diagramId, actorId, JSON.stringify(batch)],
      );
    } catch (error) {
      // Put operations back in queue so transient failures do not lose edits.
      const existing = pending.get(key) ?? [];
      pending.set(key, [...batch, ...existing]);
      throw error;
    }
  }

  async function flushAll() {
    const keys = [...pending.keys()];
    for (const key of keys) {
      await flushKey(key);
    }
  }

  const timer = setInterval(() => {
    void flushAll();
  }, flushIntervalMs);

  return {
    async queueOperation(record: OperationRecord) {
      const key = queueKey(record.diagramId, record.actorId);
      const existing = pending.get(key) ?? [];
      existing.push(record.operation);
      pending.set(key, existing);

      if (existing.length >= maxBatchSize) {
        await flushKey(key);
      }
    },
    flushAll,
    async stop() {
      clearInterval(timer);
      await flushAll();
    },
  };
}
