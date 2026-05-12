/**
 * Utility functions for handling BigInt serialization in API responses
 */

/**
 * Converts BigInt fields to numbers for JSON serialization
 * @param obj - Object that may contain BigInt values
 * @returns Object with BigInt values converted to numbers
 */
export function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => serializeBigInt(item));
  }

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
 * Serializes a Prisma model with common BigInt fields
 * @param model - Prisma model object
 * @returns Serialized object with BigInt fields converted to numbers
 */
export function serializePrismaModel(model: any): any {
  if (!model) return model;

  const serialized: any = {};
  
  for (const [key, value] of Object.entries(model)) {
    if (typeof value === 'bigint') {
      serialized[key] = Number(value);
    } else if (value === null || value === undefined) {
      serialized[key] = value;
    } else if (Array.isArray(value)) {
      serialized[key] = value.map(item => serializePrismaModel(item));
    } else if (typeof value === 'object' && value.constructor === Object) {
      serialized[key] = serializePrismaModel(value);
    } else {
      serialized[key] = value;
    }
  }
  
  return serialized;
}

/**
 * Serializes an array of Prisma models
 * @param models - Array of Prisma model objects
 * @returns Array of serialized objects
 */
export function serializePrismaModels(models: any[]): any[] {
  return models.map(model => serializePrismaModel(model));
}

/**
 * Common BigInt fields that need serialization
 */
export const COMMON_BIGINT_FIELDS = [
  'id',
  'shopId',
  'categoryId',
  'typeId',
  'productId',
  'customerId',
  'employeeId',
  'supplierId',
  'saleId',
  'paymentId',
  'expenseId',
  'userId',
  'createdBy',
  'updatedBy',
  'entityId'
];

/**
 * Serializes specific BigInt fields in an object
 * @param obj - Object to serialize
 * @param fields - Array of field names to serialize (defaults to COMMON_BIGINT_FIELDS)
 * @returns Object with specified BigInt fields converted to numbers
 */
export function serializeBigIntFields(obj: any, fields: string[] = COMMON_BIGINT_FIELDS): any {
  if (!obj) return obj;

  const serialized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (fields.includes(key) && typeof value === 'bigint') {
      serialized[key] = Number(value);
    } else if (value === null || value === undefined) {
      serialized[key] = value;
    } else if (Array.isArray(value)) {
      serialized[key] = value.map(item => serializeBigIntFields(item, fields));
    } else if (typeof value === 'object' && value.constructor === Object) {
      serialized[key] = serializeBigIntFields(value, fields);
    } else {
      serialized[key] = value;
    }
  }
  
  return serialized;
}
