import React, { useState } from "react"

// Add print CSS
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `@media print { .no-print { display: none !important; } }`;
  document.head.appendChild(style);
}

interface ProperBillPrintProps {
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

const ProperBillPrint: React.FC<ProperBillPrintProps> = ({ sale, onClose, userRole }) => {
  const shopInfo = sale.shop || {
    name: "Your Shop Name",
    gstNo: "22AAAAA0000A1Z5",
    address: "123 Main Road, City, State, 123456",
    phone: "+91-9876543210"
  };
  const [billDate, setBillDate] = useState(getInitialDate(sale.date));
  const handlePrint = () => {
    window.print()
  }
  const handleWhatsApp = () => {
    const transportInfo = sale.transportFare > 0 ? `\nTransport: ₹${sale.transportFare}${sale.vehicleNumber ? ` (${sale.vehicleNumber})` : ''}` : '';
    const text = `*${shopInfo.name}*\nGST: ${shopInfo.gstNo || "-"}\n${shopInfo.address}\nPhone: ${shopInfo.phone || "-"}\n\nBill No: ${sale.billNo}   Date: ${billDate}\n\n${sale.items.map((item: any) => { const price = item.price_per_unit || item.pricePerUnit || 0; return `${item.name}  x${item.quantity} ${item.unit || '-'}  ₹${price}  ₹${item.quantity * price}`; }).join("\n")}${transportInfo}\n-----------------------------\nSubtotal: ₹${sale.totalAmount}\nDiscount: -₹${sale.discount || 0}\nCGST: ₹${sale.cgst || 0}\nSGST: ₹${sale.sgst || 0}\nTotal: ₹${sale.finalAmount}\n-----------------------------\nThank you!`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
  }
  return (
    <div className="print-area bg-white p-2 rounded shadow max-w-xs mx-auto" style={{ fontFamily: 'monospace', width: 300 }}>
      <div className="text-center mb-1">
        <div className="font-bold text-base">{shopInfo.name}</div>
        <div style={{ fontSize: 12 }}>GST: {shopInfo.gstNo || "-"}</div>
        <div style={{ fontSize: 12 }}>{shopInfo.address}</div>
        <div style={{ fontSize: 12 }}>Phone: {shopInfo.phone || "-"}</div>
      </div>
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
              <td className="text-center">{item.quantity} {item.unit || '-'}</td>
              <td className="text-right">₹{item.price_per_unit || item.pricePerUnit || 0}</td>
              <td className="text-right">₹{(item.quantity * (item.price_per_unit || item.pricePerUnit || 0)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-right text-xs" style={{ fontSize: 12 }}>
        <div>Subtotal: ₹{Number(sale.totalAmount - (sale.transportFare || 0)).toFixed(2)}</div>
        {sale.transportFare > 0 && <div>Transport: ₹{Number(sale.transportFare).toFixed(2)}</div>}
        <div>Discount: -₹{Number(sale.discount || 0).toFixed(2)}</div>
        <div>CGST: ₹{Number(sale.cgst || 0).toFixed(2)}</div>
        <div>SGST: ₹{Number(sale.sgst || 0).toFixed(2)}</div>
        <div className="font-bold" style={{ fontWeight: 'bold', fontSize: 14 }}>Total: ₹{Number(sale.finalAmount).toFixed(2)}</div>
        {sale.payment_type === "partial" && (
          <>
            <div>Paid: ₹{Number(sale.paid_amount).toFixed(2)}</div>
            <div>Due: ₹{(Number(sale.finalAmount) - Number(sale.paid_amount)).toFixed(2)}</div>
          </>
        )}
      </div>
      {sale.vehicleNumber && <div className="text-center text-xs mt-1 italic">Vehicle: {sale.vehicleNumber} {sale.driverName ? `(${sale.driverName})` : ''}</div>}
      <div className="text-center mt-2" style={{ fontSize: 12 }}>
        <div>Thank you!</div>
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
      <div className="flex gap-2 mt-4 no-print">
        <button onClick={handlePrint} className="bg-green-600 text-white px-4 py-2 rounded">Print</button>
        <button onClick={handleWhatsApp} className="bg-green-500 text-white px-4 py-2 rounded">WhatsApp</button>
        <button onClick={onClose} className="ml-auto text-gray-500">Close</button>
      </div>
    </div>
  )
}

export default ProperBillPrint 