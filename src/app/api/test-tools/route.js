import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { allocateProviders } from '@/lib/allocation';
import { sseEmitter } from '@/lib/sse';

/**
 * Generate N leads concurrently for stress testing
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, count = 10 } = body;

    if (action === 'generate_leads') {
      const services = await prisma.service.findMany();
      if (services.length === 0) {
        return NextResponse.json({ error: 'No services found. Run seed first.' }, { status: 400 });
      }

      // Generate leads concurrently to test concurrency handling
      const batchSize = Math.min(count, 30); // cap at 30
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        const service = services[i % services.length];
        const phone = `${9000000000 + Math.floor(Math.random() * 999999999)}`;
        const lead = {
          name: `Test User ${Date.now()}_${i}`,
          phone,
          city: 'Test City',
          serviceId: service.id,
          description: `Stress test lead #${i + 1}`,
        };

        const promise = prisma
          .$transaction(
            async (tx) => {
              const created = await tx.lead.create({
                data: {
                  name: lead.name,
                  phone: lead.phone,
                  city: lead.city,
                  description: lead.description,
                  serviceId: lead.serviceId,
                },
              });
              const providerIds = await allocateProviders(
                tx,
                created.id,
                service.name,
                service.id
              );
              return { lead: created, assignedProviders: providerIds.length };
            },
            { isolationLevel: 'Serializable', timeout: 15000 }
          )
          .catch((err) => ({ error: err.message }));

        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(
        (r) => r.status === 'fulfilled' && !r.value?.error
      ).length;
      const failed = results.length - succeeded;

      // Notify dashboards
      sseEmitter.emit('lead_assigned', { bulk: true, count: succeeded });

      return NextResponse.json({
        success: true,
        requested: batchSize,
        succeeded,
        failed,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Test tools error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
