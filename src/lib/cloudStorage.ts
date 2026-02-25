import { ref, uploadString, getDownloadURL, getMetadata } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import type { VacationState } from '@/types';

function userFileRef(uid: string) {
  if (!storage) throw new Error('Firebase Storage is not configured');
  return ref(storage, `users/${uid}/ferieplan.json`);
}

/**
 * Upload state to cloud. Returns the new generation string from the upload metadata.
 */
export async function saveStateToCloud(uid: string, state: VacationState): Promise<string> {
  const fileRef = userFileRef(uid);
  const json = JSON.stringify(state);
  const result = await uploadString(fileRef, json, 'raw', {
    contentType: 'application/json',
  });
  return result.metadata.generation;
}

/**
 * Load state from cloud. Returns { state, generation } or null if no file exists.
 */
export async function loadStateFromCloud(
  uid: string
): Promise<{ state: VacationState; generation: string } | null> {
  try {
    const fileRef = userFileRef(uid);
    const metadata = await getMetadata(fileRef);
    const url = await getDownloadURL(fileRef);
    const response = await fetch(url);
    if (!response.ok) return null;
    const data: VacationState = await response.json();
    return { state: data, generation: metadata.generation };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'storage/object-not-found'
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch only the generation metadata without downloading the file.
 * Returns null if file doesn't exist.
 */
export async function getCloudGeneration(uid: string): Promise<string | null> {
  try {
    const fileRef = userFileRef(uid);
    const metadata = await getMetadata(fileRef);
    return metadata.generation;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'storage/object-not-found'
    ) {
      return null;
    }
    throw error;
  }
}
