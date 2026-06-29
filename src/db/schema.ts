import Dexie, { type Table } from "dexie";
import type { ArcanumEvent } from "@/core/event";
import type { ReadModel } from "@/core/read-model";

/** The immutable log row. `synced` is LOCAL metadata, not part of the envelope. */
export interface StoredEvent extends ArcanumEvent {
  synced: 0 | 1;
}

export interface ProjectionRow {
  key: "current";
  model: ReadModel;
}

export interface MetaRow {
  key: string;
  /** last server `seq` pulled (key 'sync') */
  pullCursor?: number;
  /** highest grade index whose ascension ceremony was already shown (key 'grade_ack') */
  ackGrade?: number;
}

export class ArcanumDB extends Dexie {
  events!: Table<StoredEvent, string>;
  projection!: Table<ProjectionRow, string>;
  sync_meta!: Table<MetaRow, string>;

  constructor(name = "arcanum") {
    super(name);
    this.version(1).stores({
      events: "id, synced, ts",
      projection: "key",
      sync_meta: "key",
    });
  }
}

export function createDb(name?: string): ArcanumDB {
  return new ArcanumDB(name);
}
