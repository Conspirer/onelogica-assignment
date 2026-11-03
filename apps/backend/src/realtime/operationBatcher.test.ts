import { describe, expect, it, vi } from "vitest";
import { createOperationBatcher } from "./operationBatcher.js";

describe("operationBatcher", () => {
  it("flushes immediately when max batch size is reached", async () => {
    const query = vi.fn(async () => undefined);
    const batcher = createOperationBatcher(query, {
      flushIntervalMs: 999999,
      maxBatchSize: 2,
    });

    await batcher.queueOperation({
      diagramId: "11111111-1111-1111-1111-111111111111",
      actorId: "22222222-2222-2222-2222-222222222222",
      operation: {
        opId: "op-1",
        timestamp: new Date().toISOString(),
        payload: { type: "MOVE" },
      },
    });

    await batcher.queueOperation({
      diagramId: "11111111-1111-1111-1111-111111111111",
      actorId: "22222222-2222-2222-2222-222222222222",
      operation: {
        opId: "op-2",
        timestamp: new Date().toISOString(),
        payload: { type: "MOVE" },
      },
    });

    expect(query).toHaveBeenCalledTimes(1);
    await batcher.stop();
  });

  it("keeps diagram+actor queues isolated", async () => {
    const query = vi.fn(async () => undefined);
    const batcher = createOperationBatcher(query, {
      flushIntervalMs: 999999,
      maxBatchSize: 10,
    });

    await batcher.queueOperation({
      diagramId: "11111111-1111-1111-1111-111111111111",
      actorId: "22222222-2222-2222-2222-222222222222",
      operation: {
        opId: "op-1",
        timestamp: new Date().toISOString(),
        payload: { type: "CREATE_NODE" },
      },
    });

    await batcher.queueOperation({
      diagramId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      actorId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      operation: {
        opId: "op-2",
        timestamp: new Date().toISOString(),
        payload: { type: "CONNECT" },
      },
    });

    await batcher.flushAll();

    expect(query).toHaveBeenCalledTimes(2);
    await batcher.stop();
  });
});
