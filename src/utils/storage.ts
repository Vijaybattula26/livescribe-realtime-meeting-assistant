import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { TranscriptSegment, ExtractionState } from '../types';

interface LiveScribeDB extends DBSchema {
  transcripts: {
    key: string;
    value: TranscriptSegment;
    indexes: { 'by-date': string };
  };
  session: {
    key: string;
    value: {
      id: string;
      state: ExtractionState;
      updatedAt: string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
}

const DB_NAME = 'livescribe-db';
const DB_VERSION = 2;
const SESSION_KEY = 'current_session';
const CONSENT_KEY = 'livescribe_audio_consent_granted';

let dbPromise: Promise<IDBPDatabase<LiveScribeDB>> | null = null;

function getDb(): Promise<IDBPDatabase<LiveScribeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LiveScribeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('transcripts')) {
          const transcriptStore = db.createObjectStore('transcripts', { keyPath: 'id' });
          transcriptStore.createIndex('by-date', 'startedAt');
        }
        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveTranscriptSegment(segment: TranscriptSegment): Promise<void> {
  try {
    const db = await getDb();
    await db.put('transcripts', segment);
  } catch (err) {
    console.error('[Storage] Failed to save transcript segment:', err);
  }
}

export async function saveAllTranscriptSegments(segments: TranscriptSegment[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('transcripts', 'readwrite');
    for (const seg of segments) {
      await tx.store.put(seg);
    }
    await tx.done;
  } catch (err) {
    console.error('[Storage] Failed to save transcript batch:', err);
  }
}

export async function loadTranscriptSegments(): Promise<TranscriptSegment[]> {
  try {
    const db = await getDb();
    return await db.getAll('transcripts');
  } catch (err) {
    console.error('[Storage] Failed to load transcript segments:', err);
    return [];
  }
}

export async function saveSessionState(state: ExtractionState): Promise<void> {
  try {
    const db = await getDb();
    await db.put('session', {
      id: SESSION_KEY,
      state,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Storage] Failed to save session state:', err);
  }
}

export async function loadSessionState(): Promise<ExtractionState | null> {
  try {
    const db = await getDb();
    const record = await db.get('session', SESSION_KEY);
    return record ? record.state : null;
  } catch (err) {
    console.error('[Storage] Failed to load session state:', err);
    return null;
  }
}

export async function clearAllStoredData(): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(['transcripts', 'session'], 'readwrite');
    await tx.objectStore('transcripts').clear();
    await tx.objectStore('session').clear();
    await tx.done;
  } catch (err) {
    console.error('[Storage] Failed to clear stored data:', err);
  }
}

export function getUserConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setUserConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}

const KNOWN_TERMS_KEY = 'livescribe_known_terms';

export async function saveKnownTerms(terms: string[]): Promise<void> {
  try {
    localStorage.setItem(KNOWN_TERMS_KEY, JSON.stringify(terms));
    const db = await getDb();
    await db.put('settings', { key: KNOWN_TERMS_KEY, value: terms });
  } catch (err) {
    console.error('[Storage] Failed to save known terms:', err);
  }
}

export async function loadKnownTerms(): Promise<string[]> {
  try {
    const db = await getDb();
    const entry = await db.get('settings', KNOWN_TERMS_KEY);
    if (entry && Array.isArray(entry.value)) {
      return entry.value;
    }
  } catch {
    // fallback to localStorage
  }
  try {
    const raw = localStorage.getItem(KNOWN_TERMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

