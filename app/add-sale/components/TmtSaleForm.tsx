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
  handleTmtSaleSubmit: () => void;
  paymentMethod: string;
  setPaymentMethod: (val: string) => void;
  partialAmount: number;
  setPartialAmount: (val: number) => void;
  partialPaymentMethod: string;
  setPartialPaymentMethod: (val: string) => void;
  discount: number;
  setDiscount: (val: number) => void;
  discountType: 'flat' | 'percent';
  setDiscountType: (val: 'flat' | 'percent') => void;
  tax: number;
  setTax: (val: number) => void;
  profit: number;
  subtotal: number;
  discountAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cgstPercent: number;
  sgstPercent: number;
  finalAmount: number;
  customSaleDate: string;
  setCustomSaleDate: (val: string) => void;
}

export function TmtSaleForm({
  t, userRole, loading, isSubmitting, tmtProducts, selectedTmtProduct, setSelectedTmtProduct,
  tmtQuantity, setTmtQuantity, tmtUnit, setTmtUnit, tmtPricePerUnit, setTmtPricePerUnit,
  updateTmtPriceForUnit, tmtSaleItems, addTmtItemToSale, removeTmtItem, handleTmtSaleSubmit,
  paymentMethod, setPaymentMethod, partialAmount, setPartialAmount, partialPaymentMethod,
  setPartialPaymentMethod, discount, setDiscount, discountType, setDiscountType, tax, setTax,
  profit, subtotal, discountAmount, cgstAmount, sgstAmount, cgstPercent, sgstPercent, finalAmount,
  customSaleDate, setCustomSaleDate
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

        {tmtSaleItems.length > 0 && (
          <div className="rounded-xl border border-indigo-100 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-indigo-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-indigo-700">Product</th>
                  <th className="px-3 py-2 text-left font-semibold text-indigo-700">Qty</th>
                  <th className="px-3 py-2 text-left font-semibold text-indigo-700">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-indigo-700">Total</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {tmtSaleItems.map((item: any, idx: number) => (
                  <tr key={idx} className="border-t border-indigo-50 hover:bg-indigo-50/40">
                    <td className="px-3 py-2 font-medium">
                      {item.productName}
                      {item.company && <span className="ml-1 text-xs text-gray-500">({item.company} {item.size}mm)</span>}
                    </td>
                    <td className="px-3 py-2">{item.quantity} {item.unitType}</td>
                    <td className="px-3 py-2">₹{item.pricePerUnit}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700">₹{item.totalAmount.toFixed(2)}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeTmtItem(idx)}
                        className="text-red-400 hover:text-red-600 transition"
                        title="Remove item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-gray-600">Items total</td>
                  <td className="px-3 py-2 text-right text-green-700">
                    ₹{tmtSaleItems.reduce((s: number, i: any) => s + i.totalAmount, 0).toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tmtSaleItems.length === 0 && !selectedTmtProduct && (
          <p className="text-xs text-gray-400 italic">Select a product above and click "Add Item" to add multiple TMT types to one sale.</p>
        )}
      </div>

      {/* Payment section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("Payment Information", "भुगतान की जानकारी")}</h3>

        {/* Payment method descriptions */}
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Cash:</strong> {t("Full payment in cash", "नकद में पूर्ण भुगतान")}</p>
          <p><strong>Online/Card:</strong> {t("Payment via card, UPI, or online", "कार्ड, UPI, या ऑनलाइन के माध्यम से भुगतान")}</p>
          <p><strong>Loan/Credit:</strong> {t("No payment now, full amount due", "अभी कोई भुगतान नहीं, पूरी राशि बकाया")}</p>
          <p><strong>Partial:</strong> {t("Partial payment now, remaining due", "अभी आंशिक भुगतान, शेष बकाया")}</p>
        </div>

        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cash" id="tmt-cash" />
              <Label htmlFor="tmt-cash">{t("Cash", "कैश")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="online" id="tmt-online" />
              <Label htmlFor="tmt-online">{t("Online/Card", "ऑनलाइन/कार्ड")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="loan" id="tmt-loan" />
              <Label htmlFor="tmt-loan">{t("Loan/Credit", "उधार/क्रेडिट")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="partial" id="tmt-partial" />
              <Label htmlFor="tmt-partial">{t("Partial", "आंशिक")}</Label>
            </div>
          </div>
        </RadioGroup>

        {paymentMethod === "partial" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="tmt-partialAmount">{t("Partial Amount", "आंशिक राशि")}</Label>
              <Input
                id="tmt-partialAmount"
                type="number"
                value={partialAmount}
                onChange={(e) => setPartialAmount(Number(e.target.value) || 0)}
                min="0"
                max={tmtSaleItems.reduce((sum, item) => sum + item.totalAmount, 0)}
                step="0.01"
              />
              <p className="text-sm text-gray-600 mt-1">
                {t("Due Amount", "बकाया राशि")}: ₹{(tmtSaleItems.reduce((sum, item) => sum + item.totalAmount, 0) - partialAmount).toFixed(2)}
              </p>
            </div>

            <div>
              <Label>{t("How did you receive this partial payment?", "आपने यह आंशिक भुगतान कैसे प्राप्त किया?")}</Label>
              <RadioGroup value={partialPaymentMethod} onValueChange={setPartialPaymentMethod}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="tmt-partial-cash" />
                    <Label htmlFor="tmt-partial-cash">{t("Cash", "कैश")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="online" id="tmt-partial-online" />
                    <Label htmlFor="tmt-partial-online">{t("Online/Card", "ऑनलाइन/कार्ड")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="upi" id="tmt-partial-upi" />
                    <Label htmlFor="tmt-partial-upi">{t("UPI", "यूपीआई")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cheque" id="tmt-partial-cheque" />
                    <Label htmlFor="tmt-partial-cheque">{t("Cheque", "चेक")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bank_transfer" id="tmt-partial-bank" />
                    <Label htmlFor="tmt-partial-bank">{t("Bank Transfer", "बैंक ट्रांसफर")}</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}
      </div>

      {/* Discount and Tax for TMT Sale */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("Discount and Tax", "छूट और कर")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>{t("Discount", "छूट")}</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={discount}
                onChange={e => setDiscount(Number(e.target.value))}
                min="0"
                step="0.01"
                className="w-24"
              />
              <Select value={discountType} onValueChange={v => setDiscountType(v as 'flat' | 'percent')}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">₹</SelectItem>
                  <SelectItem value="percent">%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("Tax (%)", "कर (%)")}</Label>
            <Input
              type="number"
              value={tax}
              onChange={e => setTax(Number(e.target.value))}
              min="0"
              step="0.01"
              className="w-24"
            />
          </div>
          <div>
            <Label>{t("Profit/Loss", "लाभ/हानि")}</Label>
            <div className={profit < 0 ? "text-red-600 font-bold" : "text-green-700 font-bold"}>
              {profit < 0 ? t("Loss:", "हानि:") : t("Profit:", "लाभ:")} ₹{profit.toFixed(2)}
              <span className="ml-2 text-xs text-gray-500" title={t("Profit is calculated before tax. Tax is not included in profit.", "लाभ कर से पहले की गणना है। कर लाभ में शामिल नहीं है।")}>ⓘ</span>
            </div>
            {profit < 0 && (
              <div className="text-xs text-red-600">{t("Warning: This sale is at a loss!", "चेतावनी: यह बिक्री हानि में है!")}</div>
            )}
          </div>
        </div>
      </div>

      {/* TMT Sale Bill Summary */}
      <div className="space-y-2 mt-6">
        <div className="flex justify-between text-base">
          <span>{t("Subtotal", "उप-योग")}</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base">
          <span>{t("Discount", "छूट")}</span>
          <span>- ₹{discountAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base">
          <span>{t("CGST", "सीजीएसटी")}</span>
          <span>+ ₹{cgstAmount.toFixed(2)} ({cgstPercent}%)</span>
        </div>
        <div className="flex justify-between text-base">
          <span>{t("SGST", "एसजीएसटी")}</span>
          <span>+ ₹{sgstAmount.toFixed(2)} ({sgstPercent}%)</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>{t("Total Bill", "कुल बिल")}</span>
          <span>₹{finalAmount.toFixed(2)}</span>
        </div>

        {/* Payment breakdown based on payment method */}
        {(() => {
          let paymentMethodLabel = '-';
          const allowedPartials = ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'online'];
          const paid = paymentMethod === 'partial' ? partialAmount : (paymentMethod === 'cash' || paymentMethod === 'online') ? finalAmount : 0;
          const due = finalAmount - paid;
          if (paid > 0 && due > 0 && paymentMethod === 'partial') {
            const method = (partialPaymentMethod || '').toLowerCase();
            let methodLabel = '';
            if (allowedPartials.includes(method)) {
              switch (method) {
                case 'cash': methodLabel = t('Cash', 'कैश'); break;
                case 'upi': methodLabel = t('UPI', 'यूपीआई'); break;
                case 'card': methodLabel = t('Card', 'कार्ड'); break;
                case 'bank_transfer': methodLabel = t('Bank Transfer', 'बैंक ट्रांसफर'); break;
                case 'cheque': methodLabel = t('Cheque', 'चेक'); break;
                case 'online': methodLabel = t('Online', 'ऑनलाइन'); break;
                default: methodLabel = method; break;
              }
              paymentMethodLabel = `${t('Partial', 'आंशिक')} (${methodLabel})`;
            }
          } else if (paid > 0 && due === 0) {
            switch (paymentMethod) {
              case 'cash': paymentMethodLabel = t('Full Payment', 'पूर्ण भुगतान'); break;
              case 'online': paymentMethodLabel = t('Full Payment', 'पूर्ण भुगतान'); break;
              case 'loan': paymentMethodLabel = t('No Payment', 'कोई भुगतान नहीं'); break;
              case 'partial': paymentMethodLabel = t('Partial Payment', 'आंशिक भुगतान'); break;
              default: paymentMethodLabel = paymentMethod; break;
            }
          }
          return (
            <Fragment>
              <div className="flex justify-between text-base">
                <span>{t("Payment Method", "भुगतान प्रकार")}</span>
                <span>{paymentMethodLabel}</span>
              </div>

              {/* Paid Amount - shown in green */}
              <div className="flex justify-between text-base">
                <span>{t("Paid Amount", "भुगतान की गई राशि")}</span>
                <span className="text-green-600 font-semibold">₹{paid.toFixed(2)}</span>
              </div>

              {/* Due Amount - shown in red if > 0 */}
              <div className="flex justify-between text-base">
                <span>{t("Due Amount", "बकाया राशि")}</span>
                <span className={due > 0 ? "text-red-600 font-semibold" : "text-gray-600"}>₹{due.toFixed(2)}</span>
              </div>
            </Fragment>
          );
        })()}
      </div>

      {/* TMT Date Picker for SUPER DUPER ADMIN */}
      {userRole === 'SUPER_DUPER_ADMIN' && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 mt-4">
          <Label htmlFor="tmtCustomSaleDate" className="text-red-700 font-bold mb-2 block">
            {t("Override Sale Date (Admin Only)", "बिक्री तिथि (केवल एडमिन)")}
          </Label>
          <Input
            id="tmtCustomSaleDate"
            type="date"
            value={customSaleDate}
            onChange={(e) => setCustomSaleDate(e.target.value)}
            className="bg-white"
          />
        </div>
      )}

      {/* TMT Sale Submit Button */}
      <div className="sticky bottom-4 z-10 pt-4 bg-white/80 backdrop-blur-sm -mx-4 px-4 border-t mt-4 md:static md:bg-transparent md:p-0 md:m-0 md:border-0 shadow-lg md:shadow-none pb-4 md:pb-0 safe-pb-4">
        <Button
          type="button"
          onClick={handleTmtSaleSubmit}
          disabled={
            isSubmitting ||
            // Allow submit if there are queued items OR the current form is filled
            (
              tmtSaleItems.length === 0 &&
              (!selectedTmtProduct || !tmtQuantity || !tmtPricePerUnit)
            )
          }
          className="w-full h-14 text-lg font-bold shadow-md"
        >
          {isSubmitting ? (
            <Fragment>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("Creating Sale...", "बिक्री बनाई जा रही है...")}
            </Fragment>
          ) : (
            tmtSaleItems.length > 0
              ? t("Create Sale", "बिक्री बनाएं") + ` (${tmtSaleItems.length} items)`
              : t("Create Sale", "बिक्री बनाएं")
          )}
        </Button>
      </div>
    </div>
  )
}
