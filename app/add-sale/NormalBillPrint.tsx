import React, { useState } from "react"

// Add print CSS
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `@media print { .no-print { display: none !important; } }`;
  document.head.appendChild(style);
}

interface NormalBillPrintProps {
  sale: any
  onClose: () => void
  userRole?: string
}

function getInitialDate(date?: string) {
  if (date) {
    const d = new Date(date)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

const NormalBillPrint: React.FC<NormalBillPrintProps> = ({ sale, onClose, userRole }) => {
  const [billDate, setBillDate] = useState(getInitialDate(sale.date));
  const handlePrint = () => {
    window.print()
  }
  const handleWhatsApp = () => {
    const text = `Bill No: ${sale.billNo}   Date: ${billDate}\n\n${sale.items.map((item: any) => { const price = item.price_per_unit || item.pricePerUnit || 0; return `${item.name}  x${item.quantity}  ₹${price}  ₹${item.quantity * price}`; }).join("\n")}\n-----------------------------\nSubtotal: ₹${sale.totalAmount}\nDiscount: -₹${sale.discount || 0}\nTotal: ₹${sale.finalAmount}\n-----------------------------`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
  }
  return (
    <div className="print-area bg-white p-2 rounded shadow max-w-xs mx-auto" style={{ fontFamily: 'monospace', width: 300 }}>
      <div className="flex justify-between text-xs mb-1 items-center" style={{ fontSize: 12 }}>
        <div>Bill No: {sale.billNo}</div>
        <div>
          Date: {userRole === "SUPER_ADMIN" ? (
            <>
              <input
                type="date"
                className="border rounded px-1 py-0.5 text-xs no-print"
                value={billDate}
                onChange={e => setBillDate(e.target.value)}
                style={{ minWidth: 90 }}
              />
              <span className="print-only" style={{ display: 'none' }}>{billDate}</span>
            </>
          ) : (
            billDate
          )}
        </div>
      </div>
      <table className="w-full text-xs mb-1" style={{ fontFamily: 'monospace', fontSize: 12 }}>
        <thead>
          <tr>
            <th className="text-left">Item</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amt</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item: any, i: number) => (
            <tr key={i}>
              <td>{item.name}</td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">₹{item.price_per_unit || item.pricePerUnit || 0}</td>
              <td className="text-right">₹{(item.quantity * (item.price_per_unit || item.pricePerUnit || 0)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-right text-xs" style={{ fontSize: 12 }}>
        <div>Subtotal: ₹{Number(sale.totalAmount).toFixed(2)}</div>
        <div>Discount: -₹{Number(sale.discount || 0).toFixed(2)}</div>
        <div className="font-bold" style={{ fontWeight: 'bold', fontSize: 14 }}>Total: ₹{Number(sale.finalAmount).toFixed(2)}</div>
        {sale.payment_type === "partial" && (
          <>
            <div>Paid: ₹{Number(sale.paid_amount).toFixed(2)}</div>
            <div>Due: ₹{(Number(sale.finalAmount) - Number(sale.paid_amount)).toFixed(2)}</div>
          </>
        )}
      </div>
      <div className="text-center mt-2" style={{ fontSize: 12 }}>
        <div>Thank you!</div>
      </div>
      <div className="flex gap-2 mt-4 no-print">
        <button onClick={handlePrint} className="bg-green-600 text-white px-4 py-2 rounded">Print</button>
        <button onClick={handleWhatsApp} className="bg-green-500 text-white px-4 py-2 rounded">WhatsApp</button>
        <button onClick={onClose} className="ml-auto text-gray-500">Close</button>
      </div>
      <style>{`
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; left: 0; top: 0; width: 100% !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; background: #fff !important; }
          .no-print, .DialogContent, .DialogHeader, .DialogTitle, .DialogClose { display: none !important; }
        }
      `}</style>
    </div>
  )
}

export default NormalBillPrint 