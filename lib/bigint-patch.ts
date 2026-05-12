/**
 * Global BigInt JSON serialization patch.
 * Import this ONCE at the top of your app entry (e.g. layout.tsx or instrumentation.ts).
 * After this runs, JSON.stringify() handles BigInt automatically — no per-response
 * serializeBigInt() calls needed anywhere in the codebase.
 */
if (!(BigInt.prototype as any).toJSON) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function (this: bigint) {
      return this.toString();
    },
    writable: false,
    configurable: true,
    enumerable: false,
  });
}

export {};
