import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(req: NextRequest) {
  try {
    const { productName } = await req.json();
    
    if (!productName) {
      return NextResponse.json({
        success: false,
        message: 'Product name is required'
      }, { status: 400 });
    }
    
    console.log('🔍 [Debug] Attempting to delete product:', productName);
    
    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        name: {
          contains: productName,
          mode: 'insensitive'
        }
      }
    });
    
    if (!product) {
      return NextResponse.json({
        success: false,
        message: `Product "${productName}" not found`
      }, { status: 404 });
    }
    
    console.log('🔍 [Debug] Found product to delete:', {
      id: product.id,
      name: product.name,
      shopId: product.shopId
    });
    
    // Delete the product
    await prisma.product.delete({
      where: { id: product.id }
    });
    
    console.log('✅ [Debug] Product deleted successfully');
    
    return NextResponse.json({
      success: true,
      message: `Product "${productName}" deleted successfully`,
      deletedProduct: {
        id: product.id,
        name: product.name
      }
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
