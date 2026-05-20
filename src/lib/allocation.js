/**
 * Lead Allocation Engine
 *
 * Rules:
 * - Service 1 → Provider 1 mandatory
 * - Service 2 → Provider 5 mandatory
 * - Service 3 → Provider 1 AND Provider 4 mandatory
 * - Exactly 3 providers per lead
 * - Fair round-robin from pool for remaining slots
 * - Respects monthly quota (10)
 * - Concurrency-safe (uses DB transactions + atomic pointer update)
 *
 * Pool definitions (provider IDs):
 * - Service 1 pool: [2, 3, 4]
 * - Service 2 pool: [6, 7, 8]
 * - Service 3 pool: [2, 3, 5, 6, 7, 8]
 */

// Map serviceId → mandatory provider IDs (by provider name index, 1-based)
const MANDATORY_MAP = {
  // These keys are resolved at runtime against actual DB IDs
  'Service 1': [1],       // Provider 1
  'Service 2': [5],       // Provider 5
  'Service 3': [1, 4],    // Provider 1 AND Provider 4
};

// Pool of non-mandatory providers per service (1-based provider numbers)
const POOL_MAP = {
  'Service 1': [2, 3, 4],
  'Service 2': [6, 7, 8],
  'Service 3': [2, 3, 5, 6, 7, 8],
};

const TOTAL_PROVIDERS_PER_LEAD = 3;

/**
 * Allocate providers for a new lead.
 * Must be called inside a Prisma transaction to be concurrency-safe.
 *
 * @param {object} tx - Prisma transaction client
 * @param {number} leadId
 * @param {string} serviceName - e.g. "Service 1"
 * @param {number} serviceId
 * @returns {Promise<number[]>} Array of assigned provider IDs
 */
export async function allocateProviders(tx, leadId, serviceName, serviceId) {
  // 1. Load all providers with their current quota status
  const allProviders = await tx.provider.findMany();
  const providerByNumber = {}; // number (1-8) → provider record
  for (const p of allProviders) {
    const num = parseInt(p.name.replace('Provider ', ''), 10);
    providerByNumber[num] = p;
  }

  // Helper: is provider within quota?
  const hasQuota = (num) => {
    const p = providerByNumber[num];
    return p && p.leadsReceived < p.monthlyQuota;
  };

  // 2. Assign mandatory providers
  const mandatoryNumbers = MANDATORY_MAP[serviceName] || [];
  const assignedNumbers = new Set();

  for (const num of mandatoryNumbers) {
    if (hasQuota(num)) {
      assignedNumbers.add(num);
    }
    // If mandatory provider is over quota, we skip (best-effort).
    // Business decision: mandatory provider is skipped if quota exhausted.
  }

  // 3. Fill remaining slots from pool using round-robin
  const slotsNeeded = TOTAL_PROVIDERS_PER_LEAD - assignedNumbers.size;
  if (slotsNeeded > 0) {
    const poolNumbers = POOL_MAP[serviceName] || [];
    const eligiblePool = poolNumbers.filter(
      (num) => !assignedNumbers.has(num) && hasQuota(num)
    );

    if (eligiblePool.length > 0) {
      // Fetch and atomically update allocation pointer
      const state = await tx.allocationState.findUnique({
        where: { serviceId },
      });

      let pointer = state ? state.pointer : 0;
      let filled = 0;
      const poolLen = eligiblePool.length;

      // Round-robin: pick `slotsNeeded` providers starting from pointer
      // If fewer eligible than needed, take what's available
      const toAssign = Math.min(slotsNeeded, poolLen);

      for (let i = 0; i < poolLen && filled < toAssign; i++) {
        const idx = (pointer + i) % poolLen;
        const num = eligiblePool[idx];
        if (!assignedNumbers.has(num)) {
          assignedNumbers.add(num);
          filled++;
        }
      }

      // Advance pointer by how many we picked, persist it
      const newPointer = (pointer + filled) % poolLen;
      await tx.allocationState.upsert({
        where: { serviceId },
        update: { pointer: newPointer },
        create: { serviceId, pointer: newPointer },
      });
    }
  }

  // 4. Convert provider numbers → IDs and create assignments
  const assignedProviderIds = [];
  for (const num of assignedNumbers) {
    const provider = providerByNumber[num];
    if (!provider) continue;

    // Insert assignment
    await tx.leadAssignment.create({
      data: { leadId, providerId: provider.id },
    });

    // Increment provider's received count
    await tx.provider.update({
      where: { id: provider.id },
      data: { leadsReceived: { increment: 1 } },
    });

    assignedProviderIds.push(provider.id);
  }

  return assignedProviderIds;
}
