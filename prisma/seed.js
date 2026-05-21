const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Upsert Services
  const service1 = await prisma.service.upsert({
    where: { name: 'Service 1' },
    update: {},
    create: { name: 'Service 1' },
  });
  const service2 = await prisma.service.upsert({
    where: { name: 'Service 2' },
    update: {},
    create: { name: 'Service 2' },
  });
  const service3 = await prisma.service.upsert({
    where: { name: 'Service 3' },
    update: {},
    create: { name: 'Service 3' },
  });

  console.log('Services seeded:', service1.name, service2.name, service3.name);

  // Upsert 8 Providers
  for (let i = 1; i <= 8; i++) {
    await prisma.provider.upsert({
      where: { name: `Provider ${i}` },
      update: {},
      create: {
        name: `Provider ${i}`,
        monthlyQuota: 10,
        leadsReceived: 0,
      },
    });
  }

  console.log('Providers seeded: Provider 1 through Provider 8');

  // Seed AllocationState for each service (round-robin pointer starts at 0)
  for (const service of [service1, service2, service3]) {
    await prisma.allocationState.upsert({
      where: { serviceId: service.id },
      update: {},
      create: { serviceId: service.id, pointer: 0 },
    });
  }

  console.log('AllocationState seeded for all services');
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
