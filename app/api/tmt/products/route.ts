import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server'
import { getTmtProductsForShop } from '../../../lib/tmtUtils'
import { validateToken } from '../../../lib/tokenUtils'
import { canAccessShop } from '../../../lib/shopAccessUtils'
import { serializeBigInt } from '../../../lib/serializationUtils'


export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const decoded = await validateToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shopId')
    
    if (!shopId) {
      return NextResponse.json(
        { success: false, message: 'Shop ID is required' },
        { status: 400 }
      )
    }

    // SUPER_DUPER_ADMIN: Only show products from shops they created (complete isolation)
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // Verify the shop belongs to this SUPER_DUPER_ADMIN
      const shop = await prisma.shop.findFirst({
        where: {
          id: BigInt(parseInt(shopId)),
          createdBy: BigInt(decoded.userId),
          isActive: true
        }
      });
      
      if (!shop) {
        console.log('❌ TMT Products API - Shop not owned by SUPER_DUPER_ADMIN');
        return NextResponse.json({ 
          success: true, 
          data: { products: [] } 
        });
      }
      
      console.log('🔄 TMT Products API: Fetching products for SUPER_DUPER_ADMIN shopId:', shopId);
      
      // Get all shops owned by this SUPER_DUPER_ADMIN for filtering
      const userShops = await prisma.shop.findMany({
        where: {
          createdBy: BigInt(decoded.userId),
          isActive: true
        },
        select: { id: true }
      });
      
      const userShopIds = userShops.map(s => Number(s.id));
      
      if (userShopIds.length === 0) {
        return NextResponse.json({ 
          success: true, 
          data: { products: [] } 
        });
      }
      
      // Fetch products with proper isolation: 
      // 1. Shop-specific products from user's shops
      // 2. Global products (shopId: null) that are associated with companies in user's shops
      // This ensures complete isolation between different SUPER_DUPER_ADMINs
      let products;
      try {
        products = await prisma.tmtProduct.findMany({
          where: {
            isActive: true,
            OR: [
              // Shop-specific products from user's shops
              {
                shopId: {
                  in: userShops.map(s => s.id)
                }
              },
              // Global products (shopId: null) that are associated with companies used in user's shops
              // This ensures isolation: only show global products that use companies the user has access to
              {
                shopId: null,
                OR: [
                  // Company is shop-specific and belongs to user's shop
                  {
                    company: {
                      shopId: {
                        in: userShops.map(s => s.id)
                      },
                      isActive: true
                    }
                  },
                  // Company is global but has products in user's shops (proves association)
                  {
                    company: {
                      shopId: null,
                      isActive: true,
                      products: {
                        some: {
                          shopId: {
                            in: userShops.map(s => s.id)
                          },
                          isActive: true
                        }
                      }
                    }
                  }
                ]
              }
            ]
          },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                shopId: true
              }
            },
            size: {
              select: {
                id: true,
                sizeMm: true
              }
            },
            inventory: {
              where: { shopId: BigInt(parseInt(shopId)) }
              // Note: supplier relation fetched separately to avoid foreign key issues
            }
          },
          orderBy: [
            { company: { name: 'asc' } },
            { size: { sizeMm: 'asc' } }
          ]
        });
      } catch (queryError: any) {
        console.error('Error fetching TMT products from database:', queryError);
        console.error('Query error details:', {
          message: queryError?.message,
          code: queryError?.code,
          meta: queryError?.meta
        });
        throw queryError;
      }
      
      // Check if we have any products
      if (!products || products.length === 0) {
        return NextResponse.json({
          success: true,
          data: { products: [] }
        });
      }
      
      // Get all product IDs and inventory IDs for batch querying suppliers
      const productIds = products.map(p => p.id);
      const shopIdBigInt = BigInt(parseInt(shopId));
      
      // Get all inventory IDs to fetch suppliers separately
      const inventoryIds: BigInt[] = [];
      products.forEach(p => {
        if (p.inventory && Array.isArray(p.inventory)) {
          p.inventory.forEach(inv => {
            if (inv && inv.id && inv.supplierId) {
              inventoryIds.push(inv.id);
            }
          });
        }
      });
      
      // Batch fetch suppliers for inventory items
      const suppliersMap = new Map<bigint, any>();
      if (inventoryIds.length > 0) {
        try {
          const inventoryItems = await prisma.tmtInventory.findMany({
            where: {
              id: { in: inventoryIds },
              supplierId: { not: null }
            },
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }).catch((supplierQueryError: any) => {
            console.warn('Error querying suppliers for inventory:', supplierQueryError);
            // If supplier relation doesn't exist or has issues, return empty array
            return [];
          });
          
          if (inventoryItems && Array.isArray(inventoryItems)) {
            inventoryItems.forEach(item => {
              if (item && item.supplierId && item.supplier) {
                suppliersMap.set(item.id, item.supplier);
              }
            });
          }
        } catch (supplierError: any) {
          console.warn('Error fetching suppliers for inventory:', supplierError?.message || supplierError);
          // Continue without supplier data
        }
      }

      // Batch fetch latest sales for all products (get all, then filter to latest per product)
      // TmtSale doesn't have productId directly - it's in TmtSaleItem
      let allSaleItems: any[] = [];
      try {
        allSaleItems = await prisma.tmtSaleItem.findMany({
          where: {
            productId: { in: productIds },
            sale: {
              shopId: shopIdBigInt,
              isActive: true
            },
            isActive: true
          },
          include: {
            sale: {
              select: {
                id: true,
                saleDate: true
              }
            }
          },
          orderBy: {
            sale: {
              saleDate: 'desc'
            }
          }
        });
      } catch (salesError: any) {
        console.warn('Error fetching TMT sales:', salesError?.message || salesError);
        allSaleItems = [];
      }

      // Create a map of productId -> latest sale (first occurrence after sorting)
      const latestSaleMap = new Map();
      allSaleItems.forEach(saleItem => {
        if (!latestSaleMap.has(saleItem.productId)) {
          // Store the sale item with its sale data for unitPrice access
          latestSaleMap.set(saleItem.productId, {
            productId: saleItem.productId,
            saleDate: saleItem.sale.saleDate,
            pricePerUnit: saleItem.unitPrice ? Number(saleItem.unitPrice) : null
          });
        }
      });

      // Batch fetch latest purchases for all products (get all, then filter to latest per product)
      let allPurchases: any[] = [];
      try {
        allPurchases = await prisma.tmtPurchaseItem.findMany({
          where: {
            productId: { in: productIds },
            purchase: {
              shopId: shopIdBigInt,
              isActive: true
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            purchase: true
          }
        });
      } catch (purchasesError: any) {
        console.warn('Error fetching TMT purchases:', purchasesError?.message || purchasesError);
        allPurchases = [];
      }

      // Create a map of productId -> latest purchase (first occurrence after sorting)
      const latestPurchaseMap = new Map();
      allPurchases.forEach(purchase => {
        if (!latestPurchaseMap.has(purchase.productId)) {
          latestPurchaseMap.set(purchase.productId, purchase);
        }
      });

      // Map products to match the expected format, including pricing data
      const mappedProducts = products.map((p) => {
        try {
          const latestSale = latestSaleMap.get(p.id);
          const latestPurchase = latestPurchaseMap.get(p.id);
          
          // Calculate cost price: If we have sale price, estimate cost at 95% of sale price
          // This is an approximation since TMT purchases don't store price directly
          const latestSellingPricePerKg = latestSale ? Number(latestSale.pricePerUnit) : 0;
          const latestCostPricePerKg = latestSellingPricePerKg > 0 ? latestSellingPricePerKg * 0.95 : 0;

          // Get inventory data safely
          const inventoryItem = p.inventory && Array.isArray(p.inventory) && p.inventory.length > 0 ? p.inventory[0] : null;
          
          // Safely get supplier name from map or inventory item
          let supplierName = null;
          let supplierId = null;
          try {
            if (inventoryItem) {
              supplierId = inventoryItem.supplierId ? Number(inventoryItem.supplierId) : null;
              // Try to get from suppliers map first
              if (inventoryItem.id && suppliersMap.has(inventoryItem.id)) {
                supplierName = suppliersMap.get(inventoryItem.id).name;
              } else if (inventoryItem.supplier) {
                // Fallback to direct relation if available
                supplierName = inventoryItem.supplier.name;
              }
            }
          } catch (e) {
            // Supplier relation might not be loaded or might be null
            console.warn('Could not access supplier for inventory item:', inventoryItem?.id);
          }
          
          return {
            id: Number(p.id),
            companyId: Number(p.companyId),
            sizeId: Number(p.sizeId),
            productName: p.productName || '',
            weightPerRodKg: Number(p.weightPerRodKg || 0),
            rodsPerBundle: Number(p.rodsPerBundle || 0),
            weightPerBundleKg: Number(p.weightPerBundleKg || 0),
            defaultUnit: p.defaultUnit || 'KG',
            isActive: p.isActive !== undefined ? p.isActive : true,
            shopId: p.shopId ? Number(p.shopId) : null,
            company: { name: p.company?.name || '' },
            size: { sizeMm: Number(p.size?.sizeMm || 0) },
            availableQtyKg: inventoryItem ? Number(inventoryItem.availableQtyKg || 0) : 0,
            supplierId: supplierId,
            supplierName: supplierName,
            costPricePerKg: inventoryItem && inventoryItem.costPricePerKg !== null && inventoryItem.costPricePerKg !== undefined ? Number(inventoryItem.costPricePerKg) : latestCostPricePerKg,
            sellingPricePerKg: inventoryItem && inventoryItem.sellingPricePerKg !== null && inventoryItem.sellingPricePerKg !== undefined ? Number(inventoryItem.sellingPricePerKg) : latestSellingPricePerKg,
            costPricePerPiece: inventoryItem && inventoryItem.costPricePerPiece !== null && inventoryItem.costPricePerPiece !== undefined ? Number(inventoryItem.costPricePerPiece) : null,
            sellingPricePerPiece: inventoryItem && inventoryItem.sellingPricePerPiece !== null && inventoryItem.sellingPricePerPiece !== undefined ? Number(inventoryItem.sellingPricePerPiece) : null,
            minStockKg: inventoryItem && inventoryItem.minStockKg !== null && inventoryItem.minStockKg !== undefined ? Number(inventoryItem.minStockKg) : null,
            maxStockKg: inventoryItem && inventoryItem.maxStockKg !== null && inventoryItem.maxStockKg !== undefined ? Number(inventoryItem.maxStockKg) : null,
            totalAmount: inventoryItem && inventoryItem.totalAmount !== null && inventoryItem.totalAmount !== undefined ? Number(inventoryItem.totalAmount) : null,
            totalAmountFromKg: inventoryItem && inventoryItem.totalAmountFromKg !== null && inventoryItem.totalAmountFromKg !== undefined ? Number(inventoryItem.totalAmountFromKg) : null,
            totalAmountFromPieces: inventoryItem && inventoryItem.totalAmountFromPieces !== null && inventoryItem.totalAmountFromPieces !== undefined ? Number(inventoryItem.totalAmountFromPieces) : null,
            lastPurchaseDate: latestPurchase ? latestPurchase.createdAt : null,
            lastSaleDate: latestSale ? latestSale.saleDate : null
          };
        } catch (error: any) {
          console.error('Error mapping product:', p.id, error);
          // Return a safe fallback
          return {
            id: Number(p.id),
            companyId: Number(p.companyId),
            sizeId: Number(p.sizeId),
            productName: p.productName || '',
            weightPerRodKg: Number(p.weightPerRodKg || 0),
            rodsPerBundle: Number(p.rodsPerBundle || 0),
            weightPerBundleKg: Number(p.weightPerBundleKg || 0),
            defaultUnit: p.defaultUnit || 'KG',
            isActive: p.isActive !== undefined ? p.isActive : true,
            shopId: p.shopId ? Number(p.shopId) : null,
            company: { name: p.company?.name || '' },
            size: { sizeMm: Number(p.size?.sizeMm || 0) },
            availableQtyKg: 0,
            supplierId: null,
            supplierName: null,
            costPricePerKg: 0,
            sellingPricePerKg: 0,
            minStockKg: null,
            maxStockKg: null,
            totalAmount: null,
            lastPurchaseDate: null,
            lastSaleDate: null
          };
        }
      });
      
      const filteredProducts = mappedProducts;
      
      const serializedProducts = filteredProducts.map(serializeBigInt);
      
      return NextResponse.json({
        success: true,
        data: { products: serializedProducts }
      });
    }
    
    // For other roles, use existing access check
    console.log('🔍 TMT Products API - Requested shopId:', shopId);
    const canAccess = await canAccessShop(token, parseInt(shopId))
    console.log('🔍 TMT Products API - Can access shop', shopId, ':', canAccess);
    if (!canAccess) {
      console.log('❌ TMT Products API - Access denied for shopId:', shopId);
      return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 })
    }

    console.log('🔄 TMT Products API: Fetching products for shopId:', shopId)
    const products = await getTmtProductsForShop(parseInt(shopId))
    console.log('📦 TMT Products API: Retrieved', products.length, 'products')
    console.log('📋 TMT Products API: Sample product:', products[0] || 'No products found')
    
    // Use shared serialization utility

    // Serialize all BigInt and Decimal fields
    const serializedProducts = products.map(serializeBigInt);
    
    return NextResponse.json({
      success: true,
      data: { products: serializedProducts }
    })
  } catch (error: any) {
    console.error('Error fetching TMT products:', error)
    console.error('Error stack:', error?.stack)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch TMT products',
        error: error?.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  } finally {
  }
}

// POST /api/tmt/products - Create a new TMT product
export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const decoded = await validateToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      productName, 
      companyId, 
      sizeId, 
      weightPerRodKg, 
      rodsPerBundle, 
      weightPerBundleKg, 
      defaultUnit, 
      shopId 
    } = body

    // Validate required fields
    if (!productName || !companyId || !sizeId || !weightPerRodKg || !rodsPerBundle || !weightPerBundleKg || !defaultUnit) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: productName, companyId, sizeId, weightPerRodKg, rodsPerBundle, weightPerBundleKg, defaultUnit' },
        { status: 400 }
      )
    }

    // SUPER_DUPER_ADMIN: Allow creating products for shops they created OR global products
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      if (shopId) {
        // If shopId is provided, verify the shop belongs to this SUPER_DUPER_ADMIN
        const shop = await prisma.shop.findFirst({
          where: {
            id: BigInt(parseInt(shopId)),
            createdBy: BigInt(decoded.userId),
            isActive: true
          }
        });
        
        if (!shop) {
          return NextResponse.json(
            { success: false, message: 'You can only create TMT products for shops you created' },
            { status: 403 }
          );
        }
      } else {
        // For global products (shopId: null), verify the company belongs to a shop owned by this SUPER_DUPER_ADMIN
        // This ensures isolation - global products are only visible to the SUPER_DUPER_ADMIN who owns the company's shop
        const company = await prisma.tmtCompany.findUnique({
          where: { id: BigInt(companyId) },
          include: { shop: true }
        });
        
        if (!company) {
          return NextResponse.json(
            { success: false, message: 'Company not found' },
            { status: 404 }
          );
        }
        
        if (company.shopId) {
          // Company is shop-specific, verify the shop belongs to this SUPER_DUPER_ADMIN
          if (company.shop && company.shop.createdBy !== BigInt(decoded.userId)) {
            return NextResponse.json(
              { success: false, message: 'You can only create global products using companies from your shops' },
              { status: 403 }
            );
          }
        } else {
          // Company is global - check if this company has been used in any shops owned by this SUPER_DUPER_ADMIN
          // This ensures isolation: global products can only be created with companies that the SUPER_DUPER_ADMIN has access to
          const userShops = await prisma.shop.findMany({
            where: {
              createdBy: BigInt(decoded.userId),
              isActive: true
            },
            select: { id: true }
          });
          
          const userShopIds = userShops.map(s => s.id);
          
          // Check if company has products in user's shops OR if company has any association with user's shops
          const hasAssociationWithUserShops = await prisma.tmtProduct.findFirst({
            where: {
              companyId: BigInt(companyId),
              shopId: {
                in: userShopIds
              },
              isActive: true
            }
          });
          
          if (!hasAssociationWithUserShops) {
            return NextResponse.json(
              { success: false, message: 'You can only create global products using companies that are associated with your shops. Please create a shop-specific product first, or use a company from your shops.' },
              { status: 403 }
            );
          }
        }
      }
    } else {
      // For other roles, check shop access
      if (shopId) {
        const canAccess = await canAccessShop(token, parseInt(shopId))
        if (!canAccess) {
          return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 })
        }
      }
    }

    // Create the TMT product
    const tmtProduct = await prisma.tmtProduct.create({
      data: {
        productName,
        companyId: BigInt(companyId),
        sizeId: BigInt(sizeId),
        weightPerRodKg: parseFloat(weightPerRodKg),
        rodsPerBundle: parseInt(rodsPerBundle),
        weightPerBundleKg: parseFloat(weightPerBundleKg),
        defaultUnit: defaultUnit,
        shopId: shopId ? BigInt(shopId) : null // Global if no shopId
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        },
        size: {
          select: {
            id: true,
            sizeMm: true
          }
        }
      }
    })

    // Convert BigInt fields to numbers for JSON serialization
    const serializedProduct = {
      id: Number(tmtProduct.id),
      productName: tmtProduct.productName,
      companyId: Number(tmtProduct.companyId),
      sizeId: Number(tmtProduct.sizeId),
      weightPerRodKg: Number(tmtProduct.weightPerRodKg),
      rodsPerBundle: tmtProduct.rodsPerBundle,
      weightPerBundleKg: Number(tmtProduct.weightPerBundleKg),
      defaultUnit: tmtProduct.defaultUnit,
      shopId: tmtProduct.shopId ? Number(tmtProduct.shopId) : null,
      createdAt: tmtProduct.createdAt,
      updatedAt: tmtProduct.updatedAt,
      company: {
        id: Number(tmtProduct.company.id),
        name: tmtProduct.company.name
      },
      size: {
        id: Number(tmtProduct.size.id),
        sizeMm: Number(tmtProduct.size.sizeMm)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'TMT product created successfully',
      data: { product: serializedProduct }
    })

  } catch (error) {
    console.error('Error creating TMT product:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to create TMT product' },
      { status: 500 }
    )
  } finally {
  }
}

// PUT /api/tmt/products - Update a TMT product
export async function PUT(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const decoded = await validateToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      id,
      productName, 
      companyId, 
      sizeId, 
      weightPerRodKg, 
      rodsPerBundle, 
      weightPerBundleKg, 
      defaultUnit, 
      shopId 
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!productName || !companyId || !sizeId || !weightPerRodKg || !rodsPerBundle || !weightPerBundleKg || !defaultUnit) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: productName, companyId, sizeId, weightPerRodKg, rodsPerBundle, weightPerBundleKg, defaultUnit' },
        { status: 400 }
      )
    }

    // Check if product exists
    const existingProduct = await prisma.tmtProduct.findUnique({
      where: { id: BigInt(id) },
      include: { shop: true }
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, message: 'TMT product not found' },
        { status: 404 }
      )
    }

    // SUPER_DUPER_ADMIN: Verify they own the product or it's a global product they can access
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      if (existingProduct.shopId && existingProduct.shop) {
        // Verify the product's shop belongs to this SUPER_DUPER_ADMIN
        if (existingProduct.shop.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json(
            { error: 'You can only update TMT products from shops you created' },
            { status: 403 }
          )
        }
      } else if (!existingProduct.shopId) {
        // Global product - verify the company belongs to a shop owned by this SUPER_DUPER_ADMIN
        const company = await prisma.tmtCompany.findUnique({
          where: { id: existingProduct.companyId },
          include: { shop: true }
        })
        
        if (company) {
          const userShops = await prisma.shop.findMany({
            where: {
              createdBy: BigInt(decoded.userId),
              isActive: true
            },
            select: { id: true }
          })
          
          const userShopIds = userShops.map(s => s.id)
          
          // Check if company is shop-specific and belongs to user's shop
          if (company.shopId && !userShopIds.includes(company.shopId)) {
            return NextResponse.json(
              { error: 'You can only update global products that use companies from your shops' },
              { status: 403 }
            )
          }
          
          // If company is global, check if it has products in user's shops
          if (!company.shopId) {
            const hasProductsInUserShops = await prisma.tmtProduct.findFirst({
              where: {
                companyId: existingProduct.companyId,
                shopId: { in: userShopIds },
                isActive: true
              }
            })
            
            if (!hasProductsInUserShops) {
              return NextResponse.json(
                { error: 'You can only update global products that use companies associated with your shops' },
                { status: 403 }
              )
            }
          }
        }
      }
      
      // If shopId is provided in update, verify it belongs to this SUPER_DUPER_ADMIN
      if (shopId !== undefined && shopId !== null) {
        const shop = await prisma.shop.findFirst({
          where: {
            id: BigInt(parseInt(shopId)),
            createdBy: BigInt(decoded.userId),
            isActive: true
          }
        })
        if (!shop) {
          return NextResponse.json(
            { error: 'You can only assign TMT products to shops you created' },
            { status: 403 }
          )
        }
      }
      
      // If setting to global (shopId: null), verify the company belongs to user's shops
      if (shopId === null) {
        const company = await prisma.tmtCompany.findUnique({
          where: { id: BigInt(companyId) },
          include: { shop: true }
        })
        
        if (company) {
          const userShops = await prisma.shop.findMany({
            where: {
              createdBy: BigInt(decoded.userId),
              isActive: true
            },
            select: { id: true }
          })
          
          const userShopIds = userShops.map(s => s.id)
          
          if (company.shopId && !userShopIds.includes(company.shopId)) {
            return NextResponse.json(
              { error: 'You can only create global products using companies from your shops' },
              { status: 403 }
            )
          }
          
          if (!company.shopId) {
            const hasProductsInUserShops = await prisma.tmtProduct.findFirst({
              where: {
                companyId: BigInt(companyId),
                shopId: { in: userShopIds },
                isActive: true
              }
            })
            
            if (!hasProductsInUserShops) {
              return NextResponse.json(
                { error: 'You can only create global products using companies associated with your shops' },
                { status: 403 }
              )
            }
          }
        }
      }
    } else {
      // For other roles, verify they have access to the product's shop
      if (existingProduct.shopId) {
        const hasAccess = await canAccessShop(token, Number(existingProduct.shopId))
        if (!hasAccess) {
          return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 })
        }
      }
      // If updating shopId, verify access
      if (shopId) {
        const hasAccess = await canAccessShop(token, parseInt(shopId))
        if (!hasAccess) {
          return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 })
        }
      }
    }

    // Update the TMT product
    const tmtProduct = await prisma.tmtProduct.update({
      where: { id: BigInt(id) },
      data: {
        productName,
        companyId: BigInt(companyId),
        sizeId: BigInt(sizeId),
        weightPerRodKg: parseFloat(weightPerRodKg),
        rodsPerBundle: parseInt(rodsPerBundle),
        weightPerBundleKg: parseFloat(weightPerBundleKg),
        defaultUnit: defaultUnit,
        shopId: shopId !== undefined ? (shopId ? BigInt(shopId) : null) : existingProduct.shopId // Preserve existing shopId if not provided, allow null for global
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        },
        size: {
          select: {
            id: true,
            sizeMm: true
          }
        }
      }
    })

    // Convert BigInt fields to numbers for JSON serialization
    const serializedProduct = {
      id: Number(tmtProduct.id),
      productName: tmtProduct.productName,
      companyId: Number(tmtProduct.companyId),
      sizeId: Number(tmtProduct.sizeId),
      weightPerRodKg: Number(tmtProduct.weightPerRodKg),
      rodsPerBundle: tmtProduct.rodsPerBundle,
      weightPerBundleKg: Number(tmtProduct.weightPerBundleKg),
      defaultUnit: tmtProduct.defaultUnit,
      shopId: tmtProduct.shopId ? Number(tmtProduct.shopId) : null,
      createdAt: tmtProduct.createdAt,
      updatedAt: tmtProduct.updatedAt,
      company: {
        id: Number(tmtProduct.company.id),
        name: tmtProduct.company.name
      },
      size: {
        id: Number(tmtProduct.size.id),
        sizeMm: Number(tmtProduct.size.sizeMm)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'TMT product updated successfully',
      data: { product: serializedProduct }
    })

  } catch (error) {
    console.error('Error updating TMT product:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update TMT product' },
      { status: 500 }
    )
  } finally {
  }
}

// DELETE /api/tmt/products - Delete a TMT product
export async function DELETE(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const decoded = await validateToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Check if product exists
    const existingProduct = await prisma.tmtProduct.findUnique({
      where: { id: BigInt(id) },
      include: { shop: true }
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, message: 'TMT product not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this product (via shop ownership or assignment)
    if (decoded.role === 'SUPER_DUPER_ADMIN') {
      // SUPER_DUPER_ADMIN: Verify the product's shop belongs to this SUPER_DUPER_ADMIN
      if (existingProduct.shopId && existingProduct.shop) {
        if (existingProduct.shop.createdBy !== BigInt(decoded.userId)) {
          return NextResponse.json(
            { error: 'You can only delete TMT products from shops you created' },
            { status: 403 }
          )
        }
      } else {
        // Global product - verify the company belongs to a shop owned by this SUPER_DUPER_ADMIN
        const company = await prisma.tmtCompany.findUnique({
          where: { id: existingProduct.companyId },
          include: { shop: true }
        })
        
        if (company) {
          const userShops = await prisma.shop.findMany({
            where: {
              createdBy: BigInt(decoded.userId),
              isActive: true
            },
            select: { id: true }
          })
          
          const userShopIds = userShops.map(s => s.id)
          
          // Check if company is shop-specific and belongs to user's shop
          if (company.shopId && !userShopIds.includes(company.shopId)) {
            return NextResponse.json(
              { error: 'You can only delete global products that use companies from your shops' },
              { status: 403 }
            )
          }
          
          // If company is global, check if it has products in user's shops
          if (!company.shopId) {
            const hasProductsInUserShops = await prisma.tmtProduct.findFirst({
              where: {
                companyId: existingProduct.companyId,
                shopId: { in: userShopIds },
                isActive: true
              }
            })
            
            if (!hasProductsInUserShops) {
              return NextResponse.json(
                { error: 'You can only delete global products that use companies associated with your shops' },
                { status: 403 }
              )
            }
          }
        }
      }
    } else if (existingProduct.shopId) {
      // For other roles, verify they have access to the product's shop
      const hasAccess = await canAccessShop(token, Number(existingProduct.shopId))
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to this shop' }, { status: 403 })
      }
    }

    // Delete the TMT product
    await prisma.tmtProduct.delete({
      where: { id: BigInt(id) }
    })

    return NextResponse.json({
      success: true,
      message: 'TMT product deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting TMT product:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete TMT product' },
      { status: 500 }
    )
  } finally {
  }
}