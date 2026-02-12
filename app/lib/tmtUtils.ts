// Enhanced TMT Bar Unit Conversion Utilities
// Updated to work with the new TMT database schema

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TMT Bar Unit Types
export type TmtUnitType = 'ton' | 'bundle' | 'piece' | 'kg';

// TMT Product Interface
export interface TmtProduct {
  id: number;
  companyId: number;
  sizeId: number;
  productName: string;
  weightPerRodKg: number;
  rodsPerBundle: number;
  weightPerBundleKg: number;
  defaultUnit: string;
  company?: {
    name: string;
  };
  size?: {
    sizeMm: number;
  };
}

// Conversion Result Interface
export interface ConversionResult {
  equivalentKg: number;
  equivalentPieces: number;
  equivalentBundles: number;
  equivalentTons: number;
}

// Get TMT product by ID with company and size details
export async function getTmtProduct(productId: number): Promise<TmtProduct | null> {
  try {
    const product = await prisma.tmtProduct.findFirst({
      where: {
        id: BigInt(productId),
        isActive: true
      },
      include: {
        company: {
          select: {
            name: true
          }
        },
        size: {
          select: {
            sizeMm: true
          }
        }
      }
    });

    if (!product) return null;

    return {
      id: Number(product.id),
      companyId: Number(product.companyId),
      sizeId: Number(product.sizeId),
      productName: product.productName,
      weightPerRodKg: Number(product.weightPerRodKg),
      rodsPerBundle: Number(product.rodsPerBundle),
      weightPerBundleKg: Number(product.weightPerBundleKg),
      defaultUnit: product.defaultUnit as TmtUnitType,
      company: { name: product.company.name },
      size: { sizeMm: Number(product.size.sizeMm) }
    };
  } catch (error) {
    console.error('Error fetching TMT product:', error);
    return null;
  }
}

// Convert TMT units to kilograms
export function convertToKg(quantity: number, unitType: TmtUnitType | undefined, product: TmtProduct): number {
  // Fallback: if unit is missing, assume quantity is already in kg
  if (!unitType) return quantity;
  switch (unitType) {
    case 'piece':
      return quantity * product.weightPerRodKg;
    case 'bundle':
      // Calculate from pieces: bundles × rods per bundle × weight per rod
      // This ensures accuracy based on actual product configuration
      return quantity * product.rodsPerBundle * product.weightPerRodKg;
    case 'ton':
      return quantity * 1000; // 1 ton = 1000 kg
    case 'kg':
      return quantity;
    default:
      return quantity; // be tolerant instead of throwing
  }
}

// Convert from kilograms to any unit
export function convertFromKg(kg: number, unitType: TmtUnitType | undefined, product: TmtProduct): number {
  if (!unitType) return kg;
  switch (unitType) {
    case 'piece':
      return kg / product.weightPerRodKg;
    case 'bundle':
      // Calculate from pieces: kg ÷ (rods per bundle × weight per rod)
      // This ensures accuracy based on actual product configuration
      const bundleWeightKg = product.rodsPerBundle * product.weightPerRodKg;
      return bundleWeightKg > 0 ? kg / bundleWeightKg : 0;
    case 'ton':
      return kg / 1000;
    case 'kg':
      return kg;
    default:
      return kg;
  }
}

// Get comprehensive conversion for a quantity
export function getConversionResult(quantity: number, unitType: TmtUnitType | undefined, product: TmtProduct): ConversionResult {
  const equivalentKg = convertToKg(quantity, unitType, product);

  // For pieces calculation, use direct conversion when possible for accuracy
  let equivalentPieces = 0;
  if (unitType === 'bundle') {
    // Direct conversion: bundles × rods per bundle (more accurate)
    equivalentPieces = quantity * product.rodsPerBundle;
  } else if (unitType === 'piece') {
    // Already in pieces
    equivalentPieces = quantity;
  } else {
    // Convert from kg to pieces
    equivalentPieces = convertFromKg(equivalentKg, 'piece', product);
  }

  // For bundles calculation, use direct conversion when possible
  let equivalentBundles = 0;
  if (unitType === 'bundle') {
    // Already in bundles
    equivalentBundles = quantity;
  } else if (unitType === 'piece') {
    // Direct conversion: pieces / rods per bundle (more accurate)
    equivalentBundles = quantity / product.rodsPerBundle;
  } else {
    // Convert from kg to bundles
    equivalentBundles = convertFromKg(equivalentKg, 'bundle', product);
  }

  const equivalentTons = convertFromKg(equivalentKg, 'ton', product);

  return {
    equivalentKg: Math.round(equivalentKg * 1000) / 1000, // Round to 3 decimal places
    equivalentPieces: Math.round(equivalentPieces * 100) / 100, // Round to 2 decimal places
    equivalentBundles: Math.round(equivalentBundles * 100) / 100,
    equivalentTons: Math.round(equivalentTons * 1000) / 1000
  };
}

// Format TMT quantity for display
export function formatTmtQuantity(quantity: number, unitType: TmtUnitType | undefined, product: TmtProduct): string {
  const conversion = getConversionResult(quantity, unitType, product);

  const parts = [];

  // Always show the original quantity
  parts.push(`${quantity} ${(unitType || 'kg')}${quantity !== 1 ? 's' : ''}`);

  // Show conversions for other units
  if ((unitType || 'kg') !== 'kg' && conversion.equivalentKg > 0) {
    parts.push(`${conversion.equivalentKg} kg`);
  }
  if ((unitType || 'kg') !== 'piece' && conversion.equivalentPieces > 0) {
    parts.push(`${conversion.equivalentPieces} piece${conversion.equivalentPieces !== 1 ? 's' : ''}`);
  }
  if ((unitType || 'kg') !== 'bundle' && conversion.equivalentBundles > 0) {
    parts.push(`${conversion.equivalentBundles} bundle${conversion.equivalentBundles !== 1 ? 's' : ''}`);
  }
  if ((unitType || 'kg') !== 'ton' && conversion.equivalentTons > 0) {
    parts.push(`${conversion.equivalentTons} ton${conversion.equivalentTons !== 1 ? 's' : ''}`);
  }

  return parts.join(' ≈ ');
}

// Get available TMT units
export function getAvailableTmtUnits(): { value: TmtUnitType; label: string; labelHi: string }[] {
  return [
    { value: 'kg', label: 'Kilogram', labelHi: 'किलोग्राम' },
    { value: 'piece', label: 'Piece', labelHi: 'पीस' },
    { value: 'bundle', label: 'Bundle', labelHi: 'बंडल' },
    { value: 'ton', label: 'Ton', labelHi: 'टन' }
  ];
}

// Get available TMT units based on selling options
export function getAvailableTmtUnitsForProduct(sellByWeight: boolean, sellByBundle: boolean, sellByPiece: boolean): { value: TmtUnitType; label: string; labelHi: string }[] {
  const allUnits = getAvailableTmtUnits();
  const availableUnits: { value: TmtUnitType; label: string; labelHi: string }[] = [];

  // Add weight-based units if selling by weight is enabled
  if (sellByWeight) {
    availableUnits.push(
      { value: 'kg', label: 'Kilogram', labelHi: 'किलोग्राम' },
      { value: 'ton', label: 'Ton', labelHi: 'टन' }
    );
  }

  // Add bundle unit if selling by bundle is enabled
  if (sellByBundle) {
    availableUnits.push({ value: 'bundle', label: 'Bundle', labelHi: 'बंडल' });
  }

  // Add piece unit if selling by piece is enabled
  if (sellByPiece) {
    availableUnits.push({ value: 'piece', label: 'Piece', labelHi: 'पीस' });
  }

  // If no selling options are enabled, return all units (fallback)
  if (availableUnits.length === 0) {
    return allUnits;
  }

  return availableUnits;
}

// Get TMT inventory for a product and shop
export async function getTmtInventory(productId: number, shopId: number): Promise<{
  availableQtyKg: number;
  availablePieces: number;
  availableBundles: number;
  availableTons: number;
  lastUpdated: Date;
} | null> {
  try {
    const inventory = await prisma.tmtInventory.findUnique({
      where: {
        productId_shopId: {
          productId: BigInt(productId),
          shopId: BigInt(shopId)
        }
      },
      include: {
        product: {
          select: {
            weightPerRodKg: true,
            weightPerBundleKg: true
          }
        }
      }
    });

    if (!inventory) return null;

    const availableQtyKg = Number(inventory.availableQtyKg);
    const weightPerRodKg = Number(inventory.product.weightPerRodKg);
    const weightPerBundleKg = Number(inventory.product.weightPerBundleKg);

    return {
      availableQtyKg,
      availablePieces: Math.round((availableQtyKg / weightPerRodKg) * 100) / 100,
      availableBundles: Math.round((availableQtyKg / weightPerBundleKg) * 100) / 100,
      availableTons: Math.round((availableQtyKg / 1000) * 1000) / 1000,
      lastUpdated: inventory.lastUpdated
    };
  } catch (error) {
    console.error('Error fetching TMT inventory:', error);
    return null;
  }
}

// Update TMT inventory (add or subtract)
export async function updateTmtInventory(
  productId: number,
  shopId: number,
  quantityKg: number,
  operation: 'add' | 'subtract',
  additionalData?: {
    supplierId?: number | null;
    sellingPricePerKg?: number | null;
    costPricePerKg?: number | null;
    costPricePerPiece?: number | null;
    sellingPricePerPiece?: number | null;
    minStockKg?: number | null;
    maxStockKg?: number | null;
    totalAmount?: number | null;
    totalAmountFromKg?: number | null;
    totalAmountFromPieces?: number | null;
  }
): Promise<boolean> {
  try {
    const sign = operation === 'add' ? 1 : -1;
    const changeAmount = quantityKg * sign;

    console.log(`[TMT Inventory] updateTmtInventory called: ProductID=${productId}, ShopID=${shopId}, KG=${quantityKg}, Op=${operation}`);

    // Check if inventory record exists
    const existingInventory = await prisma.tmtInventory.findUnique({
      where: {
        productId_shopId: {
          productId: BigInt(productId),
          shopId: BigInt(shopId)
        }
      }
    });

    console.log(`[TMT Inventory] Existing record found: ${!!existingInventory} ${existingInventory ? `(Qty: ${existingInventory.availableQtyKg})` : ''}`);

    const updateData: any = {
      availableQtyKg: 0,
      lastUpdated: new Date(),
      isActive: true
    };

    if (existingInventory) {
      // Update existing inventory
      const currentQty = Number(existingInventory.availableQtyKg);
      const newQty = currentQty + changeAmount;
      console.log(`[TMT Inventory] Updating: ${currentQty} + ${changeAmount} = ${newQty}`);

      updateData.availableQtyKg = newQty >= 0 ? newQty : 0;

      // Update additional fields if provided (for both add and update operations when adding)
      if (additionalData) {
        if (additionalData.supplierId !== undefined) {
          updateData.supplierId = additionalData.supplierId ? BigInt(additionalData.supplierId) : null;
        }
        if (additionalData.sellingPricePerKg !== undefined) {
          updateData.sellingPricePerKg = additionalData.sellingPricePerKg || null;
        }
        if (additionalData.costPricePerKg !== undefined) {
          updateData.costPricePerKg = additionalData.costPricePerKg || null;
        }
        if (additionalData.costPricePerPiece !== undefined) {
          updateData.costPricePerPiece = additionalData.costPricePerPiece || null;
        }
        if (additionalData.sellingPricePerPiece !== undefined) {
          updateData.sellingPricePerPiece = additionalData.sellingPricePerPiece || null;
        }
        if (additionalData.minStockKg !== undefined) {
          updateData.minStockKg = additionalData.minStockKg || null;
        }
        if (additionalData.maxStockKg !== undefined) {
          updateData.maxStockKg = additionalData.maxStockKg || null;
        }
        if (additionalData.totalAmount !== undefined) {
          updateData.totalAmount = additionalData.totalAmount || null;
        }
        if (additionalData.totalAmountFromKg !== undefined) {
          updateData.totalAmountFromKg = additionalData.totalAmountFromKg !== null ? additionalData.totalAmountFromKg : null;
        }
        if (additionalData.totalAmountFromPieces !== undefined) {
          updateData.totalAmountFromPieces = additionalData.totalAmountFromPieces !== null ? additionalData.totalAmountFromPieces : null;
        }
      }

      await prisma.tmtInventory.update({
        where: {
          productId_shopId: {
            productId: BigInt(productId),
            shopId: BigInt(shopId)
          }
        },
        data: updateData
      });
    } else {
      // Create new inventory record
      const createData: any = {
        productId: BigInt(productId),
        shopId: BigInt(shopId),
        availableQtyKg: changeAmount >= 0 ? changeAmount : 0,
        reservedQtyKg: 0,
        lastUpdated: new Date(),
        isActive: true
      };

      // Add additional fields if provided
      if (additionalData) {
        if (additionalData.supplierId !== undefined) {
          createData.supplierId = additionalData.supplierId ? BigInt(additionalData.supplierId) : null;
        }
        if (additionalData.sellingPricePerKg !== undefined) {
          createData.sellingPricePerKg = additionalData.sellingPricePerKg || null;
        }
        if (additionalData.costPricePerKg !== undefined) {
          createData.costPricePerKg = additionalData.costPricePerKg || null;
        }
        if (additionalData.costPricePerPiece !== undefined) {
          createData.costPricePerPiece = additionalData.costPricePerPiece || null;
        }
        if (additionalData.sellingPricePerPiece !== undefined) {
          createData.sellingPricePerPiece = additionalData.sellingPricePerPiece || null;
        }
        if (additionalData.minStockKg !== undefined) {
          createData.minStockKg = additionalData.minStockKg || null;
        }
        if (additionalData.maxStockKg !== undefined) {
          createData.maxStockKg = additionalData.maxStockKg || null;
        }
        if (additionalData.totalAmount !== undefined) {
          createData.totalAmount = additionalData.totalAmount || null;
        }
        if (additionalData.totalAmountFromKg !== undefined) {
          createData.totalAmountFromKg = additionalData.totalAmountFromKg || null;
        }
        if (additionalData.totalAmountFromPieces !== undefined) {
          createData.totalAmountFromPieces = additionalData.totalAmountFromPieces || null;
        }
      }

      await prisma.tmtInventory.create({
        data: createData
      });
    }

    return true;
  } catch (error) {
    console.error('Error updating TMT inventory:', error);
    return false;
  }
}

// Validate inventory availability
export async function validateInventoryAvailability(
  productId: number,
  shopId: number,
  requiredKg: number
): Promise<{ available: boolean; availableKg: number }> {
  try {
    const inventory = await prisma.tmtInventory.findUnique({
      where: {
        productId_shopId: {
          productId: BigInt(productId),
          shopId: BigInt(shopId)
        }
      },
      select: {
        availableQtyKg: true
      }
    });

    const availableKg = inventory ? Number(inventory.availableQtyKg) : 0;

    return {
      available: availableKg >= requiredKg,
      availableKg
    };
  } catch (error) {
    console.error('Error validating inventory:', error);
    return { available: false, availableKg: 0 };
  }
}

// Get all TMT products for a shop
export async function getTmtProductsForShop(shopId: number): Promise<TmtProduct[]> {
  try {
    console.log('🔍 getTmtProductsForShop: Fetching products for shopId:', shopId)

    const products = await prisma.tmtProduct.findMany({
      where: {
        isActive: true,
        OR: [
          { shopId: null }, // Global products
          { shopId: shopId } // Shop-specific products
        ]
      },
      include: {
        company: true,
        size: true,
        inventory: {
          where: { shopId: shopId }
        }
      },
      orderBy: [
        { company: { name: 'asc' } },
        { size: { sizeMm: 'asc' } }
      ]
    });

    console.log('📊 getTmtProductsForShop: Found', products.length, 'raw products from database')

    const mappedProducts = products.map(p => ({
      id: Number(p.id),
      companyId: Number(p.companyId),
      sizeId: Number(p.sizeId),
      productName: p.productName,
      weightPerRodKg: Number(p.weightPerRodKg),
      rodsPerBundle: Number(p.rodsPerBundle),
      weightPerBundleKg: Number(p.weightPerBundleKg),
      defaultUnit: p.defaultUnit,
      isActive: p.isActive,
      shopId: p.shopId ? Number(p.shopId) : null,
      company: { name: p.company.name },
      size: { sizeMm: Number(p.size.sizeMm) },
      availableQtyKg: p.inventory.length > 0 ? Number(p.inventory[0].availableQtyKg) : 0
    }));

    console.log('✅ getTmtProductsForShop: Returning', mappedProducts.length, 'mapped products')
    return mappedProducts;
  } catch (error) {
    console.error('Error fetching TMT products:', error);
    return [];
  }
}

// Legacy functions for backward compatibility
export const TMT_BUNDLE_CONFIG = {
  '8mm': 12,   // 12 pieces = 1 bundle
  '10mm': 8,   // 8 pieces = 1 bundle
  '12mm': 5,   // 5 pieces = 1 bundle
  '16mm': 3    // 3 pieces = 1 bundle
}

export const TMT_WEIGHT_PER_PIECE = {
  '8mm': 0.395,  // kg per piece
  '10mm': 0.617, // kg per piece
  '12mm': 0.888, // kg per piece
  '16mm': 1.579  // kg per piece
}

export const getBundleConfig = (productName: string): number => {
  const name = productName.toLowerCase()
  if (name.includes("8mm")) return TMT_BUNDLE_CONFIG['8mm']
  if (name.includes("10mm")) return TMT_BUNDLE_CONFIG['10mm']
  if (name.includes("12mm")) return TMT_BUNDLE_CONFIG['12mm']
  if (name.includes("16mm")) return TMT_BUNDLE_CONFIG['16mm']
  return 1 // default
}

export const getWeightPerPiece = (productName: string): number => {
  const name = productName.toLowerCase()
  if (name.includes("8mm")) return TMT_WEIGHT_PER_PIECE['8mm']
  if (name.includes("10mm")) return TMT_WEIGHT_PER_PIECE['10mm']
  if (name.includes("12mm")) return TMT_WEIGHT_PER_PIECE['12mm']
  if (name.includes("16mm")) return TMT_WEIGHT_PER_PIECE['16mm']
  return 1 // default
}

export const convertTMTUnits = (quantity: number, fromUnit: string, toUnit: string, productName: string): number => {
  const bundleSize = getBundleConfig(productName)

  // Convert to pieces first
  let pieces = quantity
  if (fromUnit === "bundle") {
    pieces = quantity * bundleSize
  } else if (fromUnit === "kg") {
    const weightPerPiece = getWeightPerPiece(productName)
    pieces = quantity / weightPerPiece
  }

  // Convert from pieces to target unit
  if (toUnit === "bundle") {
    return pieces / bundleSize
  } else if (toUnit === "kg") {
    const weightPerPiece = getWeightPerPiece(productName)
    return pieces * weightPerPiece
  } else {
    return pieces // toUnit === "piece"
  }
}

// Get available chip sizes
export const getAvailableChipSizes = (): { value: string; label: string; labelHi: string }[] => {
  return [
    { value: "1/2", label: "1/2 inch", labelHi: "1/2 इंच" },
    { value: "3/4", label: "3/4 inch (5/8 inch)", labelHi: "3/4 इंच (5/8 इंच)" }
  ]
}

// Get available units for a category
export const getAvailableUnits = (categoryName: string): { value: string; label: string; labelHi: string }[] => {
  if (categoryName.toLowerCase().includes("ring")) {
    return [
      { value: "bundle", label: "Bundle", labelHi: "बंडल" }
    ]
  }

  if (categoryName.toLowerCase().includes("sand") || categoryName.toLowerCase().includes("chips")) {
    return [
      { value: "tempo", label: "Tempo (Bajaj)", labelHi: "टेम्पो (बजाज)" },
      { value: "chota_haathi", label: "Chota Haathi (Tata)", labelHi: "छोटा हाथी (टाटा)" },
      { value: "tractor", label: "Tractor", labelHi: "ट्रैक्टर" },
      { value: "407", label: "407", labelHi: "407" },
      { value: "small_hiwa", label: "Small Hiwa", labelHi: "छोटा हीवा" },
      { value: "big_hiwa", label: "Big Hiwa", labelHi: "बड़ा हीवा" },
      { value: "gram", label: "Gram", labelHi: "ग्राम" },
      { value: "kg", label: "kg", labelHi: "किलो" },
      { value: "liter", label: "Liter", labelHi: "लीटर" },
    ]
  }

  if (categoryName.toLowerCase().includes("tmt") || categoryName.toLowerCase().includes("steel")) {
    return [
      { value: "kg", label: "kg", labelHi: "किलो" },
      { value: "gram", label: "Gram", labelHi: "ग्राम" },
      { value: "liter", label: "Liter", labelHi: "लीटर" },
      { value: "piece", label: "Piece", labelHi: "पीस" },
      { value: "bundle", label: "Bundle", labelHi: "बंडल" },
      { value: "ton", label: "Ton", labelHi: "टन" }
    ]
  }

  // Default units for other categories
  return [
    { value: "bag", label: "Bag", labelHi: "बैग" },
    { value: "piece", label: "Piece", labelHi: "पीस" },
    { value: "kg", label: "kg", labelHi: "किलो" },
    { value: "gram", label: "Gram", labelHi: "ग्राम" },
    { value: "liter", label: "Liter", labelHi: "लीटर" },
    { value: "cft", label: "CFT", labelHi: "घन फुट" },
    { value: "dozen", label: "Dozen", labelHi: "दर्जन" },
    { value: "roll", label: "Roll", labelHi: "रोल" },
    { value: "bucket", label: "Bucket", labelHi: "बाल्टी" },
    { value: "units", label: "Units", labelHi: "इकाई" }
  ]
} 