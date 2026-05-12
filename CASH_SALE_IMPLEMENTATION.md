# Cash Sale Implementation

## Overview
This implementation adds cash sale functionality to the building materials inventory system, allowing walk-in customers to purchase products without creating permanent accounts.

## Features Added

### 1. Cash Sale UI (`app/cash-sale/page.tsx`)
- Customer information collection (name, phone, address)
- Product selection with stock availability display
- Stock type selection (normal/damaged)
- Flexible unit input (bags, kg, pieces, etc.)
- Quantity input with decimal support
- Price override capability
- Real-time bill calculation

### 2. Database Schema Updates
- Added `damagedQuantity` field to Product table
- Added `stockType` field to SaleItem table

### 3. API Endpoints
- New cash sale endpoint: `/api/sales/cash-sale`
- Updated sales service to route cash sales appropriately

## Database Setup

### Option 1: Manual SQL (Recommended)
Run the following SQL commands in your CockroachDB database:

```sql
-- Add damagedQuantity column to Product table
ALTER TABLE "Product" ADD COLUMN "damagedQuantity" INT DEFAULT 0;

-- Update existing products to have 0 damaged quantity
UPDATE "Product" SET "damagedQuantity" = 0 WHERE "damagedQuantity" IS NULL;

-- Add stockType column to SaleItem table
ALTER TABLE "SaleItem" ADD COLUMN "stockType" STRING DEFAULT 'normal';

-- Update existing sale items to have 'normal' stock type
UPDATE "SaleItem" SET "stockType" = 'normal' WHERE "stockType" IS NULL;
```

### Option 2: Prisma Migration (Alternative)
If you prefer to use Prisma migrations:

1. Update the schema in `prisma/schema.prisma`
2. Run: `npx prisma db push --accept-data-loss`
3. Run: `npx prisma generate`

## Usage

### Cash Sales
1. Navigate to `/cash-sale`
2. Enter customer information (phone and address required)
3. Select products from dropdown
4. Choose stock type (normal or damaged)
5. Enter unit, quantity, and price
6. Add items to bill
7. Finalize sale

### Stock Management
- Normal stock: Available quantity = `stockQuantity - damagedQuantity`
- Damaged stock: Available quantity = `damagedQuantity`
- Stock is deducted immediately upon cash sale completion

### Product Units
The system supports flexible units:
- Cement: bags, kg
- TMT bars: pieces, kg
- Bricks: pieces, tina
- Any custom unit can be entered

## API Endpoints

### POST `/api/sales/cash-sale`
Creates a new cash sale with walk-in customer.

**Request Body:**
```json
{
  "customerInfo": {
    "name": "Walk-in Customer (1234567890)",
    "phone": "1234567890",
    "address": "Customer address"
  },
  "shopId": 1,
  "saleDate": "2024-01-01",
  "totalAmount": 1000,
  "finalAmount": 1000,
  "discount": 0,
  "taxAmount": 0,
  "notes": "Cash sale",
  "items": [
    {
      "productId": "1",
      "name": "Cement",
      "stockType": "normal",
      "unit": "bag",
      "quantity": 5,
      "price_per_unit": 200
    }
  ],
  "payment_type": "cash",
  "paid_amount": 1000
}
```

## Stock Type Logic

### Normal Stock
- Deducts from `stockQuantity`
- Available quantity = `stockQuantity - damagedQuantity`
- Used for undamaged products

### Damaged Stock
- Deducts from `damagedQuantity`
- Available quantity = `damagedQuantity`
- Used for damaged products sold at discount

## Integration Points

### Sales Service
- Automatically routes cash sales to `/api/sales/cash-sale`
- Regular sales continue to use `/api/sales`
- Maintains backward compatibility

### Inventory Management
- Products page shows both normal and damaged stock
- Damaged quantity can be updated via inventory interface
- Stock availability calculations updated

## Future Enhancements

1. **Bulk Stock Updates**: Add ability to mark multiple products as damaged
2. **Stock Transfer**: Move stock between normal and damaged categories
3. **Damaged Stock Reports**: Analytics for damaged stock sales
4. **Price Discounts**: Automatic pricing for damaged stock
5. **Stock Alerts**: Notifications for low stock levels

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Run `npx prisma generate` after database changes
2. **Stock Validation**: Ensure sufficient stock before sale
3. **Database Schema**: Verify all required fields exist in database

### Testing

1. Create test products with both normal and damaged stock
2. Test cash sales with various units and quantities
3. Verify stock deduction works correctly
4. Check ledger entries are created properly

## Security Considerations

- All API endpoints require authentication
- Shop isolation ensures data privacy
- Input validation prevents invalid data
- Transaction rollback on errors maintains data integrity 