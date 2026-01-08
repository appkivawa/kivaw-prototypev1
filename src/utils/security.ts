/**
 * Security utilities for input validation and sanitization
 */

/**
 * Sanitize a string to prevent XSS and SQL injection
 * Removes potentially dangerous characters while preserving functionality
 */
export function sanitizeInput(input: string, maxLength = 1000): string {
  if (typeof input !== "string") {
    return "";
  }

  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);

  // Remove null bytes and other control characters (except newlines and tabs for text areas)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitize search query - removes special characters that could be used for injection
 */
export function sanitizeSearchQuery(query: string, maxLength = 200): string {
  if (typeof query !== "string") {
    return "";
  }

  // Trim and limit length
  let sanitized = query.trim().slice(0, maxLength);

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>'"\\]/g, "");

  return sanitized;
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== "string") {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize tag - allows alphanumeric, spaces, hyphens, underscores
 */
export function sanitizeTag(tag: string, maxLength = 50): string {
  if (typeof tag !== "string") {
    return "";
  }

  // Remove # prefix if present
  let sanitized = tag.trim().replace(/^#/, "").slice(0, maxLength);

  // Only allow alphanumeric, spaces, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_]/g, "");

  return sanitized.trim();
}

/**
 * Validate and sanitize text content (for notes, descriptions, etc.)
 */
export function sanitizeTextContent(text: string, maxLength = 5000): string {
  if (typeof text !== "string") {
    return "";
  }

  // Trim and limit length
  let sanitized = text.trim().slice(0, maxLength);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  return sanitized;
}





