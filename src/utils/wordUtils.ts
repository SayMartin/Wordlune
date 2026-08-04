/**
 * Normalizes a word string for comparison by handling various hyphen and space characters.
 *
 * - Replaces various hyphen/dash characters (U+2010 to U+2014) with a standard ASCII hyphen (-).
 * - Replaces the open box character (U+2423) with a standard space.
 * - Collapses multiple whitespaces into a single space.
 * - Converts to uppercase.
 *
 * @param w The string to normalize
 * @returns The normalized string
 */
export function normalizeForCompare(w: string): string {
  return w
    .replace(/[-\u2010\u2011\u2012\u2013\u2014]/g, "-")
    .replace(/\u2423/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}
