declare module "better-sqlite3" {
  type RunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  type Statement = {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): RunResult;
  };

  class Database {
    constructor(filename: string, options?: Record<string, unknown>);
    close(): void;
    exec(sql: string): this;
    pragma(source: string): unknown;
    prepare(sql: string): Statement;
    transaction<T extends (...args: any[]) => unknown>(fn: T): T;
  }

  export default Database;
}
