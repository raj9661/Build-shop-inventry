import { prisma } from '@/lib/prisma';

const MAX_AUDIT_LOGS = 7000;

/**
 * Write an audit log entry.
 * Uses `prisma` directly (outside a transaction) after the TX commits,
 * OR accepts a tx object to run inside an existing transaction.
 *
 * After each write it prunes the OLDEST logs so the total never exceeds MAX_AUDIT_LOGS.
 */
export async function writeAuditLog(
  tx: any,
  {
    adminId, action, tableName, recordId, beforeData, afterData, reason, shopId
  }: {
    adminId: bigint;
    action: string;
    tableName: string;
    recordId: bigint;
    beforeData: object;
    afterData?: object | null;
    reason?: string;
    shopId: bigint;
  }
) {
  const serialize = (v: any) =>
    JSON.stringify(v, (_, val) => (typeof val === 'bigint' ? val.toString() : val));

  // Write the new log entry
  await tx.adminAuditLog.create({
    data: {
      adminId,
      action,
      tableName,
      recordId,
      beforeData: serialize(beforeData),
      afterData: afterData ? serialize(afterData) : null,
      reason: reason || null,
      shopId,
    },
  });

  // Rolling window: delete oldest logs if we exceed MAX_AUDIT_LOGS
  // Run outside tx to avoid lock contention — fire-and-forget style
  try {
    const total = await prisma.adminAuditLog.count();
    if (total > MAX_AUDIT_LOGS) {
      const excess = total - MAX_AUDIT_LOGS;
      // Find the IDs of the oldest `excess` records
      const oldest = await prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'asc' },
        take: excess,
        select: { id: true },
      });
      if (oldest.length > 0) {
        await prisma.adminAuditLog.deleteMany({
          where: { id: { in: oldest.map((r) => r.id) } },
        });
      }
    }
  } catch (pruneError) {
    // Non-fatal — log prune failure should not break the main operation
    console.error('[AuditLog] Failed to prune old logs:', pruneError);
  }
}
