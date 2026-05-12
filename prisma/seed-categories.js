const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding categories and types...')

  // Create product categories
  const categories = [
    {
      name: 'Cement',
      description: 'Building materials - cement products',
      types: [
        { name: 'Lafarge', description: 'Lafarge cement products' },
        { name: 'Nuvoco', description: 'Nuvoco cement products' },
        { name: 'PSC', description: 'Portland Slag Cement' },
        { name: 'OPC', description: 'Ordinary Portland Cement' },
        { name: 'PPC', description: 'Portland Pozzolana Cement' }
      ]
    },
    {
      name: 'TMT Bars',
      description: 'Thermo Mechanically Treated steel bars',
      types: [
        { name: 'SAIL', description: 'Steel Authority of India Limited' },
        { name: 'Tata Steel', description: 'Tata Steel TMT bars' },
        { name: 'JSW Steel', description: 'JSW Steel TMT bars' },
        { name: 'Essar Steel', description: 'Essar Steel TMT bars' }
      ]
    },
    {
      name: 'Bricks',
      description: 'Construction bricks and blocks',
      types: [
        { name: 'Red Bricks', description: 'Traditional red clay bricks' },
        { name: 'Fly Ash Bricks', description: 'Environmentally friendly fly ash bricks' },
        { name: 'Concrete Blocks', description: 'Concrete masonry units' },
        { name: 'AAC Blocks', description: 'Autoclaved Aerated Concrete blocks' }
      ]
    },
    {
      name: 'Aggregates',
      description: 'Construction aggregates and stones',
      types: [
        { name: 'Coarse Aggregate', description: '20mm and 40mm aggregates' },
        { name: 'Fine Aggregate', description: 'River sand and manufactured sand' },
        { name: 'Stone Dust', description: 'Crushed stone dust' },
        { name: 'Gravel', description: 'Natural gravel stones' }
      ]
    },
    {
      name: 'Sand and Chips',
      description: 'Sand and stone chips for construction',
      types: [
        { name: 'River Sand', description: 'Natural river sand' },
        { name: 'Manufactured Sand', description: 'M-sand for construction' },
        { name: 'Stone Chips', description: 'Crushed stone chips' },
        { name: 'Gravel Chips', description: 'Gravel stone chips' }
      ]
    },
    {
      name: 'Paints',
      description: 'Interior and exterior paints',
      types: [
        { name: 'Asian Paints', description: 'Asian Paints products' },
        { name: 'Berger Paints', description: 'Berger Paints products' },
        { name: 'Dulux', description: 'Dulux paint products' },
        { name: 'Nerolac', description: 'Nerolac paint products' }
      ]
    },
    {
      name: 'Electrical',
      description: 'Electrical materials and equipment',
      types: [
        { name: 'Havells', description: 'Havells electrical products' },
        { name: 'Crompton', description: 'Crompton electrical products' },
        { name: 'Philips', description: 'Philips electrical products' },
        { name: 'Anchor', description: 'Anchor electrical products' }
      ]
    },
    {
      name: 'Plumbing',
      description: 'Plumbing materials and fittings',
      types: [
        { name: 'Astral', description: 'Astral plumbing products' },
        { name: 'Supreme', description: 'Supreme plumbing products' },
        { name: 'Finolex', description: 'Finolex plumbing products' },
        { name: 'Prince', description: 'Prince plumbing products' }
      ]
    },
    {
      name: 'Tools',
      description: 'Construction and hand tools',
      types: [
        { name: 'Bosch', description: 'Bosch power tools' },
        { name: 'Makita', description: 'Makita power tools' },
        { name: 'DeWalt', description: 'DeWalt power tools' },
        { name: 'Hand Tools', description: 'Manual hand tools' }
      ]
    }
  ]

  for (const categoryData of categories) {
    // Check if category already exists
    let category = await prisma.productCategory.findFirst({
      where: {
        name: categoryData.name,
        shopId: null // Global category
      }
    })

    // Create category if it doesn't exist
    if (!category) {
      category = await prisma.productCategory.create({
        data: {
          name: categoryData.name,
          description: categoryData.description,
          shopId: null, // Global category
          isActive: true
        }
      })
    }

    console.log(`✅ Created category: ${category.name}`)

    // Create types for this category
    for (const typeData of categoryData.types) {
      // Check if type already exists
      let type = await prisma.productType.findFirst({
        where: {
          name: typeData.name,
          shopId: null // Global type
        }
      })

      // Create type if it doesn't exist
      if (!type) {
        type = await prisma.productType.create({
          data: {
            name: typeData.name,
            description: typeData.description,
            isActive: true,
            category: { connect: { id: category.id } }
          }
        })
      }

      console.log(`  ✅ Created type: ${typeData.name} for category: ${category.name}`)
    }
  }

  console.log('🎉 Categories and types seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding categories:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
