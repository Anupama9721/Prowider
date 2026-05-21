import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { allocateProviders } from '@/lib/allocation';
import { sseEmitter } from '@/lib/sse';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, city, serviceId, description } = body;

    // Basic validation
    if (!name || !phone || !city || !serviceId || !description) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json({ error: 'Phone must be 10 digits' }, { status: 400 });
    }

    // Fetch service to get name
    const service = await prisma.service.findUnique({ where: { id: parseInt(serviceId) } });
    if (!service) {
      return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
    }

    // Run everything in a serializable transaction for concurrency safety
    let result;
    try {
      result = await prisma.$transaction(
        async (tx) => {
          // Create lead - DB unique constraint on [phone, serviceId] handles duplicates
          const lead = await tx.lead.create({
            data: {
              name,
              phone,
              city,
              description,
              serviceId: service.id,
            },
          });

          // Allocate providers (round-robin + mandatory)
          const assignedProviderIds = await allocateProviders(
            tx,
            lead.id,
            service.name,
            service.id
          );

          return { lead, assignedProviderIds };
        },
        {
          isolationLevel: 'Serializable',
          timeout: 10000,
        }
      );
    } catch (txError) {
      // Unique constraint violation = duplicate lead
      if (txError.code === 'P2002') {
        return NextResponse.json(
          { error: 'You have already submitted a lead for this service with this phone number.' },
          { status: 409 }
        );
      }
      throw txError;
    }

    // Emit SSE event to all connected dashboard clients
    sseEmitter.emit('lead_assigned', {
      leadId: result.lead.id,
      serviceName: service.name,
      providerIds: result.assignedProviderIds,
      createdAt: result.lead.createdAt,
    });

    return NextResponse.json({
      success: true,
      lead: result.lead,
      assignedProviders: result.assignedProviderIds.length,
    });
  } catch (error) {
    console.error('Lead creation error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        service: true,
        assignments: {
          include: { provider: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(leads);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}
