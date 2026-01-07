# PROJECT_LOG.md - POS2025

## 📌 Project Overview
- **Goal:** Enhance POS, Takeaway, and LINE Order systems with robust option selection, quantity selector, and KDS integration.
- **Current Status:** Phase 3 (Option Recipes) nearly finished; Phase 4 (Order Management) complete.

## 📝 Recent Activity Log

### 2026-01-07
- **Unify Customer Ordering UI Design:** Redesigned `LineOrder.jsx` to match `TakeawayOrder.jsx` compact mobile-friendly style.
  - Step 1: Compact order type buttons (smaller icons, less padding)
  - Step 2: Compact form inputs (`py-2.5`, `rounded-xl`)
  - Step 3: Sticky header + compact categories bar + menu grid (`aspect-[4/3]`, `gap-1.5`)
  - Step 4: Compact confirmation page
  - Step 5: Simple success page with details card
  - Options Modal: Compact bottom sheet (`rounded-t-3xl`, smaller padding)
- **Add Options Display to All Order Views:** Added options display to 4 pages that were missing it:
  - `SalesHistory.jsx`: Transaction details modal
  - `RiderDashboard.jsx`: Order details section
  - `TablePlan.jsx`: Takeaway orders section
  - `DeliveryOrderManagement.jsx`: Order detail modal
- **Global Responsive Design Analysis:** Verified all 15+ JSX pages have proper responsive breakpoints.
- **New CSS Utilities in `index.css`:** Added typography scale, touch targets, grid helpers, modal responsive, iOS safe area.
- **Centralized Stock Deduction:** Created `processStockDeduction` helper to unify ingredient and option stock management.
- **Transactional Integrity:** Integrated stock deduction into POS, LINE, and Takeaway QR endpoints using PostgreSQL transactions.
- **Enhanced Safety:** Added availability checks that throw a 400 error if ingredients or size-options are insufficient.
- **Multiplier Support:** Ensured option-based recipe multipliers (e.g., +20% ingredients) are correctly calculated and deducted.
- **LINE Order System Improvements (5 fixes):**
  - KDS Recipe: Fixed `handleViewLineRecipe` to use `item.product_id || item.id` for base recipe fetch.
  - LINE Notification: Added Options with prices to push message `itemsList`.
  - LineOrderManagement: Added Options display with pricing below product names.
  - LineOrder Cart Bar: Redesigned compact UI with delete button and `cartKey` fix.
  - Discount Display: Created centralized `getCouponDiscountAmount` helper function.
- **Cart Bar UI Improvements:**
  - LineOrder.jsx: Redesigned for better symmetry (cart icon 64px→44px, smaller NEXT button, reduced padding).
  - TakeawayOrder.jsx: Added scrollable item list preview with quantity controls and delete button.
  - KitchenDisplay.jsx: Fixed NaN display with `parseFloat(ing.quantity_used) || 0` fallback.

### Summary of Completed Tasks
1. **Product Availability Toggle:** Refactored to include inline toggle in Menu Management.
2. **Loyalty System:** Added phone number search and coupon fetching for POS/LINE orders.
3. **Option Selection:** Added modal support for all ordering channels.
4. **KDS Integration:** Options now display in kitchen cards and recipe modals.
5. **Order Management:** Implemented editing (table transfer) and deletion of active orders.

## 🚀 Next Steps
1. **Final User Acceptance:** Ask Papa to test the stock deduction in real scenarios.
2. **Performance Review:** Monitor DB transaction performance under load.
