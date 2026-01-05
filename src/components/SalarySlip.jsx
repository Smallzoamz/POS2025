import React from 'react';

/**
 * SalarySlip Component
 * Designed for professional printing of employee payslips.
 * 
 * Data Structure Expected:
 * {
 *   employee: { name, full_name, role, hourly_rate },
 *   stats: { totalHours, shifts, lateCount },
 *   financials: { baseSalary, totalBonus, totalDeduction, netSalary },
 *   adjustments: [ { type, amount, reason, date } ],
 *   period: { start, end },
 *   settings: { shop_name, shop_address, shop_phone }
 * }
 */
const bahtText = (number) => {
    if (!number || isNaN(number)) return "";
    const primaryUnit = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    const secondaryUnit = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
    let text = "";
    const numberStr = Math.floor(number).toString();

    for (let i = 0; i < numberStr.length; i++) {
        const digit = parseInt(numberStr.charAt(i));
        const pos = numberStr.length - 1 - i;
        if (digit !== 0) {
            if (pos % 6 === 1 && digit === 1) {
                text += "";
            } else if (pos % 6 === 1 && digit === 2) {
                text += "ยี่";
            } else if (pos % 6 === 0 && digit === 1 && numberStr.length > 1 && i > 0) {
                text += "เอ็ด";
            } else {
                text += primaryUnit[digit];
            }
            text += secondaryUnit[pos % 6];
        }
        if (pos % 6 === 0 && pos > 0) text += "ล้าน";
    }
    return text + "บาทถ้วน";
};

export const SalarySlip = React.forwardRef(({ data }, ref) => {
    if (!data) return null;

    const { employee, stats, financials, adjustments = [], period, settings } = data;

    if (!employee || !stats || !financials || !period) {
        return <div className="hidden">Loading print data...</div>;
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div ref={ref} className="print-slip hidden print:block bg-white text-black p-8 font-sans text-xs leading-normal">
            <style>{`
                @media print {
                    @page { margin: 1.5cm; size: A4 portrait; }
                    body * { visibility: hidden; }
                    .print-slip, .print-slip * { visibility: visible !important; }
                    .print-slip {
                        display: block !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
                .formal-table th, .formal-table td {
                    border: 1px solid #333;
                    padding: 8px;
                }
                .formal-table th {
                    background-color: #f3f4f6;
                    text-align: center;
                }
            `}</style>

            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-black uppercase tracking-widest">{settings?.shop_name || 'POS 2025'}</h1>
                <p className="text-sm mt-1">{settings?.shop_address || 'Address not set'}</p>
                <p className="text-sm font-medium">โทร: {settings?.shop_phone || '-'}</p>
                <div className="mt-6 border-y-2 border-black py-2">
                    <h2 className="text-xl font-bold uppercase tracking-widest">ใบแจ้งยอดเงินเดือนและค่าแรง (Payslip)</h2>
                </div>
            </div>

            {/* Employee & Period Info */}
            <div className="grid grid-cols-2 gap-x-12 mb-6 text-sm">
                <div className="space-y-1">
                    <p><span className="font-bold w-32 inline-block">รหัสพนักงาน:</span> #{employee.id}</p>
                    <p><span className="font-bold w-32 inline-block">ชื่อ-นามสกุล:</span> {employee.full_name || employee.name}</p>
                    <p><span className="font-bold w-32 inline-block">ตำแหน่ง:</span> {employee.role.toUpperCase()}</p>
                </div>
                <div className="space-y-1">
                    <p><span className="font-bold w-32 inline-block">งวดการจ่าย:</span> {formatDate(period.start)} - {formatDate(period.end)}</p>
                    <p><span className="font-bold w-32 inline-block">วันที่ออกเอกสาร:</span> {formatDate(new Date())}</p>
                    <p><span className="font-bold w-32 inline-block">เลขที่บิล:</span> PV-{new Date().getTime().toString().substr(-6)}</p>
                </div>
            </div>

            {/* Main Calculation Table */}
            <table className="w-full formal-table border-collapse mb-6">
                <thead>
                    <tr>
                        <th className="w-1/2">รายการจากรายรับ (Earnings)</th>
                        <th className="w-1/4">จำนวน (Unit)</th>
                        <th className="w-1/4">จำนวนเงิน (Amount)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="h-10">
                        <td className="px-4">เงินเดือน/ฐานค่าจ้าง (Hourly rate: ฿{employee.hourly_rate})</td>
                        <td className="text-center font-mono">{stats.totalHours.toFixed(1)} Hrs</td>
                        <td className="text-right font-mono font-bold">฿{financials.baseSalary.toLocaleString()}</td>
                    </tr>
                    {financials.holidayBonus > 0 && (
                        <tr className="h-10 text-indigo-700 bg-indigo-50/30">
                            <td className="px-4 font-bold">🎁 เงินโบนัสวันหยุดพิเศษ (Holiday Bonus)</td>
                            <td className="text-center font-mono">{financials.holidayHours.toFixed(1)} Hrs</td>
                            <td className="text-right font-mono font-bold">฿{financials.holidayBonus.toLocaleString()}</td>
                        </tr>
                    )}
                    {adjustments.filter(a => a.type === 'bonus').map((a, i) => (
                        <tr key={i} className="h-10">
                            <td className="px-4">{a.reason || 'เงินพิเศษ/โบนัส'}</td>
                            <td className="text-center">-</td>
                            <td className="text-right font-mono font-bold">฿{a.amount.toLocaleString()}</td>
                        </tr>
                    ))}
                    {/* Empty rows to maintain size */}
                    {[...Array(Math.max(0, 3 - (adjustments.filter(a => a.type === 'bonus').length + (financials.holidayBonus > 0 ? 1 : 0))))].map((_, i) => (
                        <tr key={i} className="h-10"><td></td><td></td><td></td></tr>
                    ))}
                    <tr className="bg-gray-50">
                        <td colSpan="2" className="text-right font-bold py-2 px-4 italic text-sm">รวมรายรับทั้งสิ้น (Total Earnings)</td>
                        <td className="text-right font-mono font-bold py-2 px-4 text-sm bg-gray-100">฿{(financials.baseSalary + financials.totalBonus).toLocaleString()}</td>
                    </tr>

                    <tr>
                        <th colSpan="2">รายการหัก (Deductions)</th>
                        <th>จำนวนเงิน (Amount)</th>
                    </tr>
                    {/* Automated Deductions */}
                    {financials.autoDeductionDetail?.late > 0 && (
                        <tr className="h-10 text-red-600">
                            <td colSpan="2" className="px-4">หักมาสาย (Late: {stats.lateHours?.toFixed(1)} ชม. @ ฿{settings.late_hourly_deduction})</td>
                            <td className="text-right font-mono font-bold">฿{financials.autoDeductionDetail.late.toLocaleString()}</td>
                        </tr>
                    )}
                    {financials.autoDeductionDetail?.absent > 0 && (
                        <tr className="h-10 text-red-600">
                            <td colSpan="2" className="px-4">หักขาดงาน (Absent: {stats.absentCount} วัน @ ฿{settings.absent_daily_deduction})</td>
                            <td className="text-right font-mono font-bold">฿{financials.autoDeductionDetail.absent.toLocaleString()}</td>
                        </tr>
                    )}
                    {financials.autoDeductionDetail?.leave > 0 && (
                        <tr className="h-10 text-red-600">
                            <td colSpan="2" className="px-4">หักลาเกินกำหนด (Excess Leave: {stats.excessLeaveDays} วัน @ ฿{settings.leave_excess_deduction})</td>
                            <td className="text-right font-mono font-bold">฿{financials.autoDeductionDetail.leave.toLocaleString()}</td>
                        </tr>
                    )}

                    {adjustments.filter(a => a.type === 'deduction').map((a, i) => (
                        <tr key={i} className="h-10">
                            <td colSpan="2" className="px-4">{a.reason || 'หักสวัสดิการ/อื่นๆ'}</td>
                            <td className="text-right font-mono font-bold">฿{a.amount.toLocaleString()}</td>
                        </tr>
                    ))}
                    {/* Empty rows to maintain size */}
                    {[...Array(Math.max(0, 3 - (adjustments.filter(a => a.type === 'deduction').length + (financials.autoDeductionDetail?.late > 0 ? 1 : 0) + (financials.autoDeductionDetail?.absent > 0 ? 1 : 0) + (financials.autoDeductionDetail?.leave > 0 ? 1 : 0))))].map((_, i) => (
                        <tr key={i} className="h-10"><td colSpan="2"></td><td></td></tr>
                    ))}
                    <tr className="bg-gray-50">
                        <td colSpan="2" className="text-right font-bold py-2 px-4 italic text-sm">รวมเงินหักทั้งสิ้น (Total Deductions)</td>
                        <td className="text-right font-mono font-bold py-2 px-4 text-sm bg-gray-100">฿{financials.totalDeduction.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>

            {/* Net Pay Box */}
            <div className="border-4 border-black p-4 mb-12 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold mb-1 underline">เงินพึงจ่ายสุทธิ (NET PAYABLE)</h3>
                    <p className="text-sm font-bold text-gray-700">({bahtText(financials.netSalary)})</p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-black">฿{financials.netSalary.toLocaleString()}</p>
                </div>
            </div>

            {/* Bottom Section: Signatures & Stamp */}
            <div className="grid grid-cols-3 gap-8 mt-16">
                <div className="text-center pt-20 border-t border-black">
                    <p className="font-bold">ลายเซ็นพนักงาน</p>
                    <p className="text-[10px] mt-1">(...................................................)</p>
                    <p className="text-[10px] mt-1">{employee.full_name || employee.name}</p>
                </div>

                <div className="flex flex-col items-center justify-center">
                    <div className="w-32 h-32 border-4 border-dashed border-gray-300 rounded-full flex flex-col items-center justify-center text-gray-300 transform -rotate-12">
                        <p className="font-bold text-sm">COMPANY</p>
                        <p className="font-bold text-sm">STAMP</p>
                        <p className="text-[10px]">ตราประทับ</p>
                    </div>
                </div>

                <div className="text-center pt-20 border-t border-black">
                    <p className="font-bold">ผู้อนุมัติ/จ่ายเงิน</p>
                    <p className="text-[10px] mt-1">(...................................................)</p>
                    <p className="text-[10px] mt-1">วันที่: ....../......./.......</p>
                </div>
            </div>

            <div className="mt-12 text-center text-[10px] text-gray-400 border-t border-dotted border-gray-300 pt-4">
                เอกสารนี้เป็นส่วนหนึ่งของระบบจัดการร้านอาหาร POS 2025 | ข้อมูลครบถ้วนตามเงื่อนไขการจ้างงาน
            </div>
        </div>
    );
});
