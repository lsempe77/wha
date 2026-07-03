import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const samplePhones = [
  { phone: '34600000000', name: 'Contacto demo 1', tags: 'demo' },
  { phone: '34611111111', name: 'Contacto demo 2', tags: 'demo' },
  { phone: '34622222222', name: 'Contacto demo 3', tags: 'demo' },
]

async function main() {
  for (const c of samplePhones) {
    await prisma.contact.upsert({
      where: { phone: c.phone },
      update: {},
      create: c,
    })
  }
  console.log('seeded', samplePhones.length, 'contacts')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
