import React from 'react';

// Simple Receipt Component
export const Receipt = React.forwardRef(({ data }, ref) => {
    if (!data) return null;

    const { tableId, items, total, date, orderId, subtotal, discount, tax, settings, grandTotal, paidDeposit } = data;

    return (
        <div ref={ref} style={{ display: 'none' }} className="print-force-show hidden print:block absolute top-0 left-0 w-full bg-white text-black p-6 font-mono text-sm leading-relaxed">
            {/* ... styles ... */}
            <style>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { margin: 0; padding: 0; }
                    
                    /* Hide EVERYTHING */
                    body * {
                        visibility: hidden;
                    }

                    /* Wrapper for Receipt */
                    .print-force-show {
                        visibility: visible !important;
                        display: block !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        z-index: 9999;
                        background: white;
                    }

                    /* Children of Receipt - Maintain their original display (flex, block, etc) */
                    .print-force-show * {
                        visibility: visible !important;
                    }
                    
                    /* Hide style tag */
                    .print-force-show style {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="text-center mb-6">
                <div className="text-3xl font-black mb-2 tracking-tighter">{settings?.shop_name || 'POS 2025'}</div>
                <div className="text-xs uppercase tracking-widest text-gray-600 mb-1">Restaurant & Bar</div>
                <div className="text-xs text-gray-500">{settings?.shop_address || 'Bangkok, Thailand'}</div>
                <div className="text-xs text-gray-500">Tel. {settings?.shop_phone || '02-999-9999'}</div>
            </div>

            <div className="mb-4 border-b-2 border-dashed border-gray-800 pb-3">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-bold">{new Date(date).toLocaleDateString('th-TH')} {new Date(date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <div className="text-xs">
                        <span className="text-gray-600">Table: </span>
                        <span className="font-bold text-lg">{tableId}</span>
                    </div>
                    <div className="text-xs">
                        <span className="text-gray-600">Bill No: </span>
                        <span className="font-bold">#{orderId}</span>
                    </div>
                </div>
            </div>

            <table className="w-full text-left mb-6 text-sm">
                <thead>
                    <tr className="border-b border-gray-300">
                        <th className="py-2 w-full font-bold">Item</th>
                        <th className="py-2 px-1 text-center font-bold">Qty</th>
                        <th className="py-2 text-right font-bold">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-gray-200">
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td className="py-2 pr-1 align-top">
                                <span className="block font-medium">{item.product_name || item.name}</span>
                            </td>
                            <td className="py-2 px-1 text-center align-top font-mono text-gray-600">{item.quantity}</td>
                            <td className="py-2 text-right align-top font-bold">{(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-t-2 border-dashed border-gray-800 pt-4 mb-8">
                {/* Breakdown */}
                <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-600 text-xs">Subtotal</span>
                    <span className="font-bold">{(subtotal || total).toLocaleString()}</span>
                </div>
                {discount > 0 && (
                    <div className="flex justify-between items-center mb-1 text-red-600">
                        <span className="text-xs">Discount</span>
                        <span className="font-bold">-{discount.toLocaleString()}</span>
                    </div>
                )}
                <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-600 text-xs">VAT {settings?.tax_rate || 7}%</span>
                    <span className="font-bold">{(tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                {paidDeposit > 0 && (
                    <div className="flex justify-between items-center mb-1 text-emerald-600 border-t border-gray-100 mt-2 pt-2">
                        <span className="text-xs italic">Paid Deposit (หักมัดจำ)</span>
                        <span className="font-bold">-{paidDeposit.toLocaleString()}</span>
                    </div>
                )}

                <div className="flex justify-between items-center text-2xl font-black mt-2 border-t border-dashed border-gray-300 pt-2">
                    <span>{paidDeposit > 0 ? 'BALANCE' : 'TOTAL'}</span>
                    <span>฿{total.toLocaleString()}</span>
                </div>
                <div className="text-right text-xs text-gray-400 mt-1">
                    (VAT Included)
                </div>
            </div>

            <div className="text-center space-y-2">
                <div className="text-sm font-bold">Thank you / ขอบคุณครับ</div>
                <div className="text-xs text-gray-400">Please come back again!</div>
                <div className="flex justify-center mt-4 text-xs tracking-widest text-gray-300">
                    *********************************
                </div>
                <div className="text-[10px] text-gray-300 mt-4 uppercase">
                    Powered by Antigravity POS
                </div>
            </div>
        </div>
    );
});
