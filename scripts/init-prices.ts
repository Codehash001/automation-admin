const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const Prisma = new PrismaClient();

async function initializePrices() {
  const defaultPrices = [
    {
      name: 'SERVICE_FEE',
      value: new Decimal(0.1), // 10%
      type: 'percentage',
    },
    {
      name: 'DELIVERY_FEE',
      value: new Decimal(10), // 10 AED
      type: 'fixed',
    },
    {
      name: 'VAT',
      value: new Decimal(0.05), // 5%
      type: 'percentage',
    },
  ];

  try {
    for (const price of defaultPrices) {
      await Prisma.additionalPrice.upsert({
        where: { name: price.name },
        update: {},
        create: {
          name: price.name,
          value: price.value,
          type: price.type,
          isActive: true,
        },
      });
    }
    console.log('✅ Default prices initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing default prices:', error);
    process.exit(1);
  } finally {
    await Prisma.$disconnect();
  }
}

initializePrices()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await Prisma.$disconnect();
  });
