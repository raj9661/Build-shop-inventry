import React, { Fragment } from "react"
if (typeof window !== 'undefined') {
  (window as any).React = React;
}
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { getAvailableTmtUnits, formatTmtQuantity } from "../../lib/tmtUtils"

export interface TmtSaleFormProps {
  t: (key: string, defaultText: string) => string;
  userRole: string | undefined;
  loading: boolean;
  isSubmitting: boolean;
  tmtProducts: any[];
  selectedTmtProduct: any;
  setSelectedTmtProduct: (val: any) => void;
  tmtQuantity: string;
  setTmtQuantity: (val: string) => void;
  tmtUnit: string;
  setTmtUnit: (val: string) => void;
  tmtPricePerUnit: string;
  setTmtPricePerUnit: (val: string) => void;
  updateTmtPriceForUnit: (product: any, unit: string) => void;
  tmtSaleItems: any[];
  addTmtItemToSale: () => void;
  removeTmtItem: (idx: number) => void;
}

export function TmtSaleForm({
  t, userRole, loading, isSubmitting, tmtProducts, selectedTmtProduct, setSelectedTmtProduct,
  tmtQuantity, setTmtQuantity, tmtUnit, setTmtUnit, tmtPricePerUnit, setTmtPricePerUnit,
  updateTmtPriceForUnit, tmtSaleItems, addTmtItemToSale, removeTmtItem
}: TmtSaleFormProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">TMT Bar Sale</h3>

      {/* TMT Product Selection */}
      <div className="space-y-3">
        <Label className="text-lg font-medium text-gray-800">TMT Product</Label>
        <Select
          value={selectedTmtProduct?.id?.toString() || ""}
          onValueChange={(value) => {
            const product = tmtProducts.find(p => p.id.toString() === value)
            setSelectedTmtProduct(product)
            // Auto-populate price based on current unit
            if (product) {
              updateTmtPriceForUnit(product, tmtUnit)
            }
          }}
          disabled={loading}
        >
          <SelectTrigger className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50">
            <SelectValue placeholder="Select TMT Product" />
          </SelectTrigger>
          <SelectContent>
            {tmtProducts.map((product: any) => (
              <SelectItem key={product.id} value={product.id.toString()} className="text-base py-3">
                {product.productName} - {product.company?.name} ({product.size?.sizeMm}mm)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quantity, Unit, and Price */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-3">
          <Label className="text-lg font-medium text-gray-800">Quantity</Label>
          <Input
            type="number"
            step="0.01"
            value={tmtQuantity}
            onChange={(e) => setTmtQuantity(e.target.value)}
            className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50"
            placeholder="Enter quantity"
            required
          />
        </div>
        <div className="space-y-3">
          <Label className="text-lg font-medium text-gray-800">Unit</Label>
          <Select
            value={tmtUnit}
            onValueChange={(unit) => {
              setTmtUnit(unit)
              // Update price when unit changes
              if (selectedTmtProduct) {
                updateTmtPriceForUnit(selectedTmtProduct, unit)
              }
            }}
          >
            <SelectTrigger className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getAvailableTmtUnits().map((unit) => (
                <SelectItem key={unit.value} value={unit.value} className="text-base py-3">
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <Label className="text-lg font-medium text-gray-800">Price per Unit (₹)</Label>
          <Input
            type="number"
            step="0.01"
            value={tmtPricePerUnit}
            onChange={(e) => setTmtPricePerUnit(e.target.value)}
            className="h-14 text-base rounded-2xl border-gray-200 bg-gray-50"
            placeholder="Auto-filled from inventory"
            required
          />
          {selectedTmtProduct && (
            <p className="text-xs text-gray-500">
              Price auto-filled from inventory. You can modify if needed.
            </p>
          )}
        </div>
      </div>

      {/* TMT Sale Summary */}
      {selectedTmtProduct && tmtQuantity && tmtPricePerUnit && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-lg font-semibold">Sale Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">{selectedTmtProduct.productName}</span>
            </div>
            <div className="text-sm text-gray-600">
              {selectedTmtProduct.company?.name} ({selectedTmtProduct.size?.sizeMm}mm) - {formatTmtQuantity(parseFloat(tmtQuantity), tmtUnit as any, selectedTmtProduct)}
            </div>
            <div className="text-sm text-gray-600">₹{tmtPricePerUnit} per {tmtUnit}</div>
            <div className="text-right text-lg font-semibold">
              Total: ₹{(parseFloat(tmtQuantity) * parseFloat(tmtPricePerUnit)).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Add Item button + Added items list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-700">Items in this Sale</h4>
          <button
            type="button"
            onClick={addTmtItemToSale}
            disabled={!selectedTmtProduct || !tmtQuantity || !tmtPricePerUnit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Add Item
          </button>
        </div>

      </div>

    </div>
  )
}
