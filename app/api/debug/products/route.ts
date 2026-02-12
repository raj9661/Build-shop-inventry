import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 [Debug] Checking all products in database...');
    
    // Get all products
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        shopId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    console.log('🔍 [Debug] Total products in database:', allProducts.length);
    console.log('🔍 [Debug] All product names:', allProducts.map(p => p.name));
    console.log('🔍 [Debug] All products with shop IDs:', allProducts.map(p => ({ name: p.name, shopId: p.shopId, isActive: p.isActive })));
    
    // Check specifically for Bangur
    const bangurProducts = allProducts.filter(p => p.name.toLowerCase().includes('bangur'));
    console.log('🔍 [Debug] Bangur products found:', bangurProducts);
    
    return NextResponse.json({
      success: true,
      data: {
        totalProducts: allProducts.length,
        allProducts: allProducts,
        bangurProducts: bangurProducts
      }
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
