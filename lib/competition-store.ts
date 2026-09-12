import { SNAPSHOT, type CompetitionData } from '@/lib/superettan';
import { applyScheduleOverrides } from '@/lib/schedule-overrides';

export type SyncResult = 'never' | 'success' | 'error';
export type SyncTrigger = 'manual' | 'automatic';

export type CompetitionSyncStatus = {
  lastAutomaticCheckAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastResult: SyncResult;
  lastTrigger: SyncTrigger | null;
  message: string;
  upstreamRequests: number;
};

export type StoredCompetitionState = {
  version: 1;
  data: CompetitionData;
  sync: CompetitionSyncStatus;
};

export type StoreLock = { release: () => Promise<void> };

export interface CompetitionStore {
  readonly configured: boolean;
  readonly kind: 'redis' | 'file' | 'unconfigured';
  load(): Promise<StoredCompetitionState | null>;
  save(state: StoredCompetitionState): Promise<void>;
  acquireLock(ttlSeconds: number): Promise<StoreLock | null>;
}

const STATE_KEY = 'slutspurten:superettan:state:v1';
const LOCK_KEY = 'slutspurten:superettan:sync-lock:v1';

function randomId() {
  return crypto.randomUUID();
}

function parentDirectory(filePath: string) {
  const separator = filePath.lastIndexOf('/');
  return separator > 0 ? filePath.slice(0, separator) : '.';
}

function absoluteFilePath(filePath: string) {
  return filePath.startsWith('/') ? filePath : `${process.cwd()}/${filePath.replace(/^\.\//, '')}`;
}

export function createInitialCompetitionState(): StoredCompetitionState {
  return {
    version: 1,
    data: { ...SNAPSHOT, fixtures: applyScheduleOverrides(SNAPSHOT.fixtures, SNAPSHOT.season) },
    sync: {
      lastAutomaticCheckAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastResult: 'never',
      lastTrigger: null,
      message: 'Ingen API-synkning har gjorts ännu.',
      upstreamRequests: 0,
    },
  };
}

function isStoredState(value: unknown): value is StoredCompetitionState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<StoredCompetitionState>;
  return state.version === 1 && Boolean(state.data) && Boolean(state.sync);
}

class RedisCompetitionStore implements CompetitionStore {
  readonly configured = true;
  readonly kind = 'redis' as const;

  constructor(private readonly url: string, private readonly token: string) {}

  private async command<T>(...parts: Array<string | number>) {
    const response = await fetch(this.url, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parts),
    });
    const payload = await response.json() as { result?: T; error?: string };
    if (!response.ok || payload.error) throw new Error(`Redis: ${payload.error ?? `HTTP ${response.status}`}`);
    return payload.result as T;
  }

  async load() {
    const value = await this.command<string | null>('GET', STATE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as unknown;
    if (!isStoredState(parsed)) throw new Error('Den sparade Redis-datan har ett okänt format.');
    return parsed;
  }

  async save(state: StoredCompetitionState) {
    await this.command<string>('SET', STATE_KEY, JSON.stringify(state));
  }

  async acquireLock(ttlSeconds: number) {
    const token = randomId();
    const result = await this.command<string | null>('SET', LOCK_KEY, token, 'NX', 'EX', ttlSeconds);
    if (result !== 'OK') return null;
    return {
      release: async () => {
        const currentToken = await this.command<string | null>('GET', LOCK_KEY);
        if (currentToken === token) await this.command<number>('DEL', LOCK_KEY);
      },
    };
  }
}

class FileCompetitionStore implements CompetitionStore {
  readonly configured = true;
  readonly kind = 'file' as const;

  constructor(private readonly filePath: string) {}

  private async fs() {
    return import('fs/promises');
  }

  async load() {
    const fs = await this.fs();
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as unknown;
      if (!isStoredState(parsed)) throw new Error('Den lokalt sparade datan har ett okänt format.');
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(state: StoredCompetitionState) {
    const fs = await this.fs();
    await fs.mkdir(parentDirectory(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomId()}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(temporaryPath, this.filePath);
  }

  async acquireLock(ttlSeconds: number) {
    const fs = await this.fs();
    const lockPath = `${this.filePath}.lock`;
    const token = randomId();
    await fs.mkdir(parentDirectory(lockPath), { recursive: true });

    const tryAcquire = async () => {
      const handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(`${token}\n${Date.now()}`, 'utf8');
      await handle.close();
    };

    try {
      await tryAcquire();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const lockContents = await fs.readFile(lockPath, 'utf8');
        const createdAt = Number(lockContents.split('\n')[1]);
        if (!Number.isFinite(createdAt) || Date.now() - createdAt <= ttlSeconds * 1000) return null;
        await fs.unlink(lockPath);
        await tryAcquire();
      } catch (retryError) {
        if ((retryError as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw retryError;
      }
    }

    return {
      release: async () => {
        try {
          const currentToken = (await fs.readFile(lockPath, 'utf8')).split('\n')[0];
          if (currentToken === token) await fs.unlink(lockPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      },
    };
  }
}

class UnconfiguredCompetitionStore implements CompetitionStore {
  readonly configured = false;
  readonly kind = 'unconfigured' as const;
  async load() { return null; }
  async save() { throw new Error('Ingen beständig datalagring är konfigurerad.'); }
  async acquireLock() { return { release: async () => undefined }; }
}

let store: CompetitionStore | null = null;

export function getCompetitionStore(): CompetitionStore {
  if (store) return store;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (redisUrl && redisToken) {
    store = new RedisCompetitionStore(redisUrl.replace(/\/$/, ''), redisToken);
    return store;
  }

  if (process.env.NODE_ENV !== 'production' || process.env.DATA_STORE === 'file') {
    const configuredPath = process.env.DATA_FILE_PATH ?? '.data/superettan-state.json';
    store = new FileCompetitionStore(absoluteFilePath(configuredPath));
    return store;
  }

  store = new UnconfiguredCompetitionStore();
  return store;
}

export async function loadCompetitionState() {
  const state = (await getCompetitionStore().load()) ?? createInitialCompetitionState();
  return {
    ...state,
    data: {
      ...state.data,
      fixtures: applyScheduleOverrides(state.data.fixtures, state.data.season),
    },
  };
}

export async function loadCompetitionData() {
  return (await loadCompetitionState()).data;
}
