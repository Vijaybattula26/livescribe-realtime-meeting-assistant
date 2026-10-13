import { ActionItem } from '../types';

/**
 * Normalizes task text for deduplication comparison
 */
export function normalizeTaskText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Computes simple word-overlap Jaccard similarity between two strings
 */
export function computeSimilarity(a: string, b: string): number {
  const normA = normalizeTaskText(a);
  const normB = normalizeTaskText(b);
  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(' '));
  const wordsB = new Set(normB.split(' '));

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  const minWords = Math.min(wordsA.size, wordsB.size);
  const subsetOverlap = minWords === 0 ? 0 : intersection / minWords;

  // Combine Jaccard and subset containment
  return Math.max(jaccard, subsetOverlap * 0.85);
}

/**
 * Merges newly extracted action items into the existing list.
 * CRITICAL RULES:
 * 1. User manual edits (isManual: true) are NEVER overwritten by AI extraction.
 * 2. User status changes (e.g. marked as 'done') are preserved.
 * 3. Similar/duplicate tasks (> 0.65 similarity) are merged rather than duplicated.
 * 4. Preserves consistent item order.
 */
export function mergeActionItems(
  existingItems: ActionItem[],
  incomingItems: ActionItem[]
): ActionItem[] {
  const result: ActionItem[] = [...existingItems];

  for (const incoming of incomingItems) {
    // 1. Check exact match by ID
    const exactIdIndex = result.findIndex((item) => item.id === incoming.id);
    if (exactIdIndex !== -1) {
      const existing = result[exactIdIndex];
      if (existing.isManual) {
        // Retain manual user overrides completely
        continue;
      }
      // Update non-manual item, but preserve done status if user marked it done
      result[exactIdIndex] = {
        ...incoming,
        status: existing.status === 'done' ? 'done' : incoming.status,
        createdAt: existing.createdAt || incoming.createdAt,
        resolvedDeadline: incoming.resolvedDeadline || existing.resolvedDeadline,
      };
      continue;
    }

    // 2. Check semantic/text similarity to prevent duplicates with different IDs
    const similarIndex = result.findIndex((item) => {
      const sim = computeSimilarity(item.task, incoming.task);
      return sim >= 0.65;
    });

    if (similarIndex !== -1) {
      const existing = result[similarIndex];
      if (existing.isManual) {
        // Keep user manual version
        continue;
      }
      // Merge: keep existing id and user status, update details with newer extraction
      result[similarIndex] = {
        ...incoming,
        id: existing.id,
        status: existing.status === 'done' ? 'done' : incoming.status,
        owner: incoming.owner || existing.owner,
        deadline: incoming.deadline || existing.deadline,
        resolvedDeadline: incoming.resolvedDeadline || existing.resolvedDeadline,
        createdAt: existing.createdAt || incoming.createdAt,
        confidence: Math.max(existing.confidence, incoming.confidence),
      };
      continue;
    }

    // 3. New unique action item
    result.push({
      ...incoming,
      id: incoming.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: incoming.createdAt || new Date().toISOString(),
    });
  }

  return result;
}
