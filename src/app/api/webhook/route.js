import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sseEmitter } from '@/lib/sse';

/**
 * Webhook endpoint: POST /api/webhook
 *
 * Idempotency:
 * - Caller must provide X-Idempotency-Key header
 * - If same key seen before, return cached result without re-processing
 * - Prevents double quota resets from duplicate webhook calls
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { eventType, providerId } = body;

    // Require idempotency key
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'X-Idempotency-Key header is required' },
        { status: 400 }
      );
    }

    if (!eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
    }

    // Check if this webhook was already processed
    const existing = await prisma.webhookEvent.findUnique({
      where: { id: idempotencyKey },
    });

    if (existing) {
      // Already processed — return original result, no side effects
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Webhook already processed (idempotent)',
        processedAt: existing.processedAt,
      });
    }

    // Handle event types
    let result;
    if (eventType === 'payment_confirmed') {
      // Reset quota for specific provider or all providers
      await prisma.$transaction(async (tx) => {
        if (providerId) {
          await tx.provider.update({
            where: { id: parseInt(providerId) },
            data: { monthlyQuota: 10, leadsReceived: 0 },
          });
        } else {
          // Reset all providers
          await tx.provider.updateMany({
            data: { monthlyQuota: 10, leadsReceived: 0 },
          });
        }

        // Also reset allocation pointers to restart round-robin
        await tx.allocationState.updateMany({
          data: { pointer: 0 },
        });

        // Record webhook event
        await tx.webhookEvent.create({
          data: {
            id: idempotencyKey,
            eventType,
            payload: body,
          },
        });
      });

      result = {
        success: true,
        idempotent: false,
        message: providerId
          ? `Quota reset for provider ${providerId}`
          : 'Quota reset for all providers',
      };
    } else {
      return NextResponse.json({ error: `Unknown eventType: ${eventType}` }, { status: 400 });
    }

    // Notify dashboards
    sseEmitter.emit('quota_reset', { message: 'Provider quotas have been reset' });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
