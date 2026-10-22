/** Reuse Batch C's matching signals for a single queue contact, without auto-merging. */
import { nameCityKey, type CandidateContact } from "@/lib/contact-duplicates";

export function matchingQueueContacts(target: CandidateContact, others: CandidateContact[]): string[] {
  if (!target.ownerUserId) return [];
  const methods = new Set(target.methods.map(m => `${m.type}:${m.normalizedValue}`));
  const name = nameCityKey(target);
  return others.filter(other => {
    if (other.id === target.id || other.ownerUserId !== target.ownerUserId) return false;
    return (name !== null && name === nameCityKey(other)) ||
      other.methods.some(m => methods.has(`${m.type}:${m.normalizedValue}`));
  }).map(other => other.id).sort();
}
