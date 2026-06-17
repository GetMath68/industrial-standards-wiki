/**
 * SHA256 hash utility for content caching
 * Uses Web Crypto API for consistent hashing across environments
 */

/**
 * Generate SHA256 hash of a string
 * @param content - String content to hash
 * @returns Hexadecimal SHA256 hash string
 */
export async function sha256(content: string): Promise<string> {
  // Use Node.js crypto module in Node environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  // Fallback to Web Crypto API for browser/deno environments
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('No crypto API available in current environment');
}

/**
 * Generate SHA256 hash of a file's content
 * @param filePath - Path to the file to hash
 * @returns Hexadecimal SHA256 hash string
 */
export async function sha256File(filePath: string): Promise<string> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return sha256(content);
}
