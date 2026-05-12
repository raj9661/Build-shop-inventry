# TMT Bar Sales Implementation

## Overview

This implementation provides a flexible unit system for TMT (Thermo Mechanically Treated) bars, allowing customers to purchase them in different units (kg, pieces, bundles) with automatic unit conversions and proper display across the application.

## Bundle Configurations

The system supports the following TMT bar bundle configurations:

| TMT Bar Size | Pieces per Bundle | Weight per Piece (kg) |
|--------------|-------------------|----------------------|
| 8mm          | 12 pieces         | 0.395 kg             |
| 10mm         | 8 pieces          | 0.617 kg             |
| 12mm         | 5 pieces          | 0.888 kg             |
| 16mm         | 3 pieces          | 1.579 kg             |

## How It Works

### 1. Add Sale Process

When creating a sale for TMT bars:

1. **Category Selection**: Select "TMT Bars" or "Steel" category
2. **Product Selection**: Choose the specific TMT bar (e.g., "10mm TMT Bar")
3. **Unit Selection**: Choose from:
   - **kg**: Weight-based pricing
   - **piece**: Individual bar pricing
   - **bundle**: Bundle-based pricing
4. **Quantity Entry**: Enter the quantity in the selected unit
5. **Automatic Conversion Display**: The system shows equivalent quantities in other units

### 2. Example Sale Scenarios

#### Scenario 1: Vivek buys 10mm TMT bars by kg
- **Product**: 10mm TMT Bar
- **Unit**: kg
- **Quantity**: 50 kg
- **Display**: "50 kg (81 pieces, 6.25 bundles)"
- **Price**: ₹65 per kg = ₹3,250

#### Scenario 2: Vivek buys 10mm TMT bars by pieces
- **Product**: 10mm TMT Bar
- **Unit**: piece
- **Quantity**: 24 pieces
- **Display**: "24 pieces (14.8 kg, 3 bundles)"
- **Price**: ₹40 per piece = ₹960

#### Scenario 3: Vivek buys 10mm TMT bars by bundles
- **Product**: 10mm TMT Bar
- **Unit**: bundle
- **Quantity**: 5 bundles
- **Display**: "5 bundles (40 pieces, 24.7 kg)"
- **Price**: ₹300 per bundle = ₹1,500

### 3. Stock Management

#### Adding Stock
- **Unit Options**: kg, piece, bundle
- **Automatic Conversion**: System calculates equivalent quantities
- **Inventory Tracking**: Stock is tracked in the selected unit

#### Stock Display
- Shows current stock in the selected unit
- Displays equivalent quantities for reference
- Low stock alerts work with any unit

### 4. Dashboard Display

#### Active Sales
- Shows TMT bar sales with proper unit formatting
- Displays equivalent quantities for clarity
- Example: "10mm TMT Bar × 50 kg (81 pieces, 6.25 bundles)"

#### Sales History
- All TMT bar sales show converted quantities
- Easy to understand regardless of original unit
- Maintains original unit for reference

### 5. Customer Ledger

#### Purchase Entries
- Shows TMT bar purchases with converted quantities
- Example: "10mm TMT Bar (50 kg (81 pieces, 6.25 bundles))"
- Helps customers understand their purchases

#### Payment Tracking
- Tracks payments against TMT bar purchases
- Shows running balance with proper formatting
- Maintains transaction history

## Technical Implementation

### 1. Database Schema

```sql
-- SaleItem table includes unit field
ALTER TABLE SaleItem ADD COLUMN unit VARCHAR(50) DEFAULT 'units';
```

### 2. Utility Functions

The system includes comprehensive utility functions in `app/lib/tmtUtils.ts`:

- `getBundleConfig(productName)`: Returns pieces per bundle
- `getWeightPerPiece(productName)`: Returns weight per piece
- `convertTMTUnits(quantity, fromUnit, toUnit, productName)`: Converts between units
- `formatTMTQuantity(quantity, unit, productName)`: Formats for display
- `getAvailableUnits(categoryName)`: Returns available units for category

### 3. Form Validation

- **Required Units**: TMT bar items must have a unit selected
- **Visual Indicators**: Red asterisk and border for required fields
- **Error Messages**: Clear validation messages in English and Hindi

### 4. Unit Conversion Logic

```javascript
// Example conversion: 50 kg of 10mm TMT bars
const pieces = 50 / 0.617 = 81 pieces
const bundles = 81 / 8 = 10.125 bundles

// Display: "50 kg (81 pieces, 10.1 bundles)"
```

## User Experience Features

### 1. Real-time Conversion Display

When selecting TMT bar units in the sale form:
- Shows equivalent quantities immediately
- Updates as quantity changes
- Helps users understand the conversion

### 2. Flexible Pricing

- **kg-based pricing**: Useful for weight-based contracts
- **piece-based pricing**: Good for retail sales
- **bundle-based pricing**: Convenient for bulk purchases

### 3. Consistent Display

- All displays use the same formatting
- Equivalent quantities shown everywhere
- Easy to understand across the application

## Benefits

### 1. Customer Flexibility
- Customers can buy in their preferred unit
- No need to convert manually
- Clear understanding of quantities

### 2. Business Efficiency
- Faster sales process
- Reduced calculation errors
- Better customer satisfaction

### 3. Inventory Management
- Accurate stock tracking
- Multiple unit support
- Better reporting

### 4. Reporting and Analytics
- Sales data in multiple units
- Easy comparison across units
- Better business insights

## Future Enhancements

1. **Dynamic Pricing**: Different prices for different units
2. **Unit Preferences**: Customer-specific unit preferences
3. **Bulk Operations**: Batch unit conversions
4. **Advanced Analytics**: Unit-based sales analysis
5. **Mobile Optimization**: Better mobile unit selection

## Support

For questions or issues with TMT bar sales:
1. Check the unit selection is correct
2. Verify the product name includes size (8mm, 10mm, 12mm, 16mm)
3. Ensure the category is "TMT Bars" or "Steel"
4. Contact support if conversion seems incorrect 