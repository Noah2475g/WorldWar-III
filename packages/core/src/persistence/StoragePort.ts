/**
 * Where saved games live (R-GAME-03/04, T-M8-00).
 *
 * The core does no I/O (R-ARCH-01), so persistence is expressed as a port with three
 * implementations: Tauri's file system in the finished game, Node's in the headless
 * runner, and memory in tests and the browser build. Without this seam, saving could
 * only ever be tested through the desktop shell.
 */
export interface StoragePort {
  list(): Promise<string[]>
  read(name: string): Promise<string>
  write(name: string, data: string): Promise<void>
  remove(name: string): Promise<void>
  exists(name: string): Promise<boolean>
}

export class StorageEntryNotFound extends Error {
  constructor(name: string) {
    super(`Speicherstand "${name}" existiert nicht.`)
    this.name = 'StorageEntryNotFound'
  }
}

/** In-memory store — the reference implementation the contract tests run against. */
export class MemoryStorage implements StoragePort {
  private entries = new Map<string, string>()

  async list(): Promise<string[]> {
    return [...this.entries.keys()].sort()
  }

  async read(name: string): Promise<string> {
    const value = this.entries.get(name)
    if (value === undefined) throw new StorageEntryNotFound(name)
    return value
  }

  async write(name: string, data: string): Promise<void> {
    this.entries.set(name, data)
  }

  async remove(name: string): Promise<void> {
    this.entries.delete(name)
  }

  async exists(name: string): Promise<boolean> {
    return this.entries.has(name)
  }
}
