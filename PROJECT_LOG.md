# PROJECT_LOG.md - POS2025

## 📌 Project Overview
- **Goal:** Enhance POS, Takeaway, and LINE Order systems with robust option selection, quantity selector, and KDS integration.
- **Current Status:** Phase 3 (Option Recipes) nearly finished; Phase 4 (Order Management) complete.

## 📝 Recent Activity Log

### 2026-01-07
- **Centralized Stock Deduction:** Created `processStockDeduction` helper to unify ingredient and option stock management.
- **Transactional Integrity:** Integrated stock deduction into POS, LINE, and Takeaway QR endpoints using PostgreSQL transactions.
- **Enhanced Safety:** Added availability checks that throw a 400 error if ingredients or size-options are insufficient.
- **Multiplier Support:** Ensured option-based recipe multipliers (e.g., +20% ingredients) are correctly calculated and deducted.

### Summary of Completed Tasks
1. **Product Availability Toggle:** Refactored to include inline toggle in Menu Management.
2. **Loyalty System:** Added phone number search and coupon fetching for POS/LINE orders.
3. **Option Selection:** Added modal support for all ordering channels.
4. **KDS Integration:** Options now display in kitchen cards and recipe modals.
5. **Order Management:** Implemented editing (table transfer) and deletion of active orders.

## 🚀 Next Steps
1. **Final User Acceptance:** Ask Papa to test the stock deduction in real scenarios.
2. **Performance Review:** Monitor DB transaction performance under load.
