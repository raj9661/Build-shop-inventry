import { prisma } from './prisma';

/**
 * Traces up the `createdBy` hierarchy to find the root SUPER_DUPER_ADMIN.
 * If the user has no createdBy (e.g. they are the root admin), returns their own ID.
 * Defaults to 1 (the original global admin) as an absolute fallback if the hierarchy is broken.
 */
export async function getRootAdminId(userId: bigint | string | number): Promise<bigint> {
  try {
    let currentId = BigInt(userId);
    let iterations = 0;
    const MAX_DEPTH = 10; // Prevent infinite loops in case of circular references

    while (iterations < MAX_DEPTH) {
      const user = await prisma.user.findUnique({
        where: { id: currentId },
        select: { id: true, role: true, createdBy: true }
      });

      if (!user) {
        // User not found, return the ID we were last looking for, or fallback to 1n
        return currentId;
      }

      if (user.role === 'SUPER_DUPER_ADMIN' || !user.createdBy) {
        return user.id;
      }

      // Move up the hierarchy
      currentId = user.createdBy;
      iterations++;
    }

    // If max depth reached, return the last known ID
    return currentId;
  } catch (error) {
    console.error('Error tracing root admin ID:', error);
    return BigInt(userId); // Fallback to their own ID if error
  }
}
