/**
 * Utility functions for serializing Prisma data types for JSON responses
 */

/**
 * Serializes BigInt and Decimal fields to JSON-safe types
 * @param obj - The object to serialize
 * @returns Serialized object with BigInt as strings and Decimal as numbers
 */
export function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle Prisma Decimal objects
  if (obj && typeof obj === 'object' && 'toNumber' in obj && typeof obj.toNumber === 'function') {
    return obj.toNumber();
  }
  
  // Handle Decimal objects with s, e, d properties (Prisma Decimal internal structure)
  if (obj && typeof obj === 'object' && 's' in obj && 'e' in obj && 'd' in obj) {
    return parseFloat(obj.toString());
  }
  
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }
  
  return obj;
}

/**
 * Serializes an array of objects
 * @param arr - Array of objects to serialize
 * @returns Serialized array
 */
export function serializeArray(arr: any[]): any[] {
  return arr.map(serializeBigInt);
}

/**
 * Serializes a single object
 * @param obj - Object to serialize
 * @returns Serialized object
 */
export function serializeObject(obj: any): any {
  return serializeBigInt(obj);
}
