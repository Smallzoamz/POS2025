# PROJECT_LOG.md - POS2025

## 📌 Project Overview
- **Goal:** Enhance POS, Takeaway, and LINE Order systems with robust option selection, quantity selector, and KDS integration.
- **Current Status:** Phase 3 (Option Recipes) nearly finished; Phase 4 (Order Management) complete.

## 📝 Recent Activity Log

### 2026-01-07
- **Unify Customer Ordering UI Design:** Redesigned `LineOrder.jsx` to match `TakeawayOrder.jsx` compact mobile-friendly style.
- **Add Options Display to All Order Views:** Added options display to SalesHistory, RiderDashboard, TablePlan, and DeliveryOrderManagement.
- **Bird Eye View Table Plan:** Implemented "Visual Map" mode with DB-driven coordinates.
- **Stock Deduction Logic:** Unified ingredient/option deduction with transactional integrity.
- **Floor Plan Designer:** Built interactive editor with persistent layout, resize handles, and decorative objects.
- **Hut Tables:** Implemented functional 'Hut' table type with fixed 4-seat capacity.
- **Area Zones (Sub-Zones):** Added visual labeled zones for organizing the floor plan (Indoor/Outdoor sub-areas).

### Summary of Recent Changes
- \[2026-01-07 14:20:32] | File: TablePlan.jsx | Line: 5 | Keyword: import | Status: Edited | Change: Fixed incorrect socket import by using named export from services/api
- \[2026-01-07 15:19:45] | File: TableManagement.jsx | Line: 284 | Keyword: updateSelectedItem | Status: Edited | Change: Implemented Hut shape support for tables with fixed 4-seat rule.
- \[2026-01-07 15:19:45] | File: TablePlan.jsx | Line: 486 | Keyword: TablePlan | Status: Edited | Change: Integrated Hut visual rendering for tables in Visual Map view.
- \[2026-01-07 15:37:31] | File: TableManagement.jsx | Line: 459 | Keyword: addObject | Status: Created | Change: Added Area Zone (Sub-Zone) component to floor plan designer.
- \[2026-01-07 15:37:31] | File: TablePlan.jsx | Line: 380 | Keyword: TablePlan | Status: Edited | Change: Implemented low-priority z-index rendering for visual Area Zones with centered labeling.
- \[2026-01-07 15:47:00] | File: TableManagement.jsx | Line: 224 | Keyword: addObject | Status: Edited | Change: Fixed 500 Error (NOT NULL constraint) by adding default naming for Area Zones.
- \[2026-01-07 15:53:00] | File: TablePlan.jsx | Line: 7 | Keyword: import | Status: Edited | Change: Added missing FaLayerGroup import to fix ReferenceError.
- \[2026-01-07 15:53:00] | File: TableManagement.jsx | Line: 545 | Keyword: Properties | Status: Created | Change: Added editable Zone Name input for Area Zones; changed label style to gray/faded.
- \[2026-01-07 16:00:00] | File: TableManagement.jsx | Line: 359 | Keyword: viewMode | Status: Hidden | Change: Suspended Visual Editor and Visual Map views due to design rethink; locked to List View.
- \[2026-01-08 09:00:00] | File: server.js | Line: 291 | Keyword: getStoreStatus | Status: Created | Change: Implemented store status logic and /api/store-status endpoint.
- \[2026-01-08 09:15:00] | File: Settings.jsx | Line: 19 | Keyword: settings | Status: Edited | Change: Added store hours and last order configuration fields.
- \[2026-01-08 10:30:00] | File: OrderEntry.jsx | Line: 37 | Keyword: storeStatus | Status: Edited | Change: Integrated status banner and order blocking for POS. Resolved all syntax errors and UI breakage.
- \[2026-01-08 11:20:00] | File: LineOrder.jsx | Line: 43 | Keyword: storeStatus | Status: Edited | Change: Integrated business hours validation and UI banner for LINE channel.
- \[2026-01-08 11:45:00] | File: TakeawayOrder.jsx | Line: 16 | Keyword: storeStatus | Status: Edited | Change: Integrated business hours validation and UI banner for public Takeaway channel.
- \[2026-01-07 19:20:00] | File: LineOrderManagement.jsx | Line: 363 | Keyword: Modal | Status: Edited | Change: Redesigned Order Detail and Payment modals to match "Obsidian & Gold" premium theme.

- \[2026-01-07 19:30:00] | File: SalesHistory.jsx | Line: 28 | Keyword: loadHistory | Status: Edited | Change: Added robust data handling and logging for sales history fetching.
- \[2026-01-07 19:30:00] | File: server.js | Line: 950 | Keyword: /api/orders/history | Status: Edited | Change: Refined SQL query with explicit timezone handling and decimal-to-float casting for better data integrity.
- \[2026-01-07 20:10:00] | File: server.js | Line: 847 | Keyword: /api/orders/history | Status: Edited | Change: Moved history route above generic :tableName route to fix shadowing conflict and added explicit date casting for robust filtering.
- \[2026-01-07 20:15:00] | File: server.js | Line: 905 | Keyword: /api/orders/:id | Status: Created | Change: Implemented numeric ID lookup route for order details to resolve blank Sales History modal issues.

## 🔄 Menu Sync Feature (POS → Website)

### 2026-01-09
- \[2026-01-09 15:28:00] | File: server.js (electron) | Line: 346 | Keyword: syncMenuToWebsite | Status: Created | Change: Added helper function to push menu data to restaurant website via Webhook.
- \[2026-01-09 15:29:00] | File: server.js (electron) | Line: 575-640 | Keyword: products/categories CRUD | Status: Edited | Change: Added auto-sync trigger after all product/category CRUD operations.
- \[2026-01-09 15:30:00] | File: server.js (electron) | Line: 650 | Keyword: /api/sync-menu-to-website | Status: Created | Change: Added Manual Sync endpoint for backup synchronization.
- \[2026-01-09 15:31:00] | File: server.js (SiteRestaurant) | Line: 454 | Keyword: /api/sync-menu | Status: Created | Change: Added Webhook receiver endpoint with Secret Key authentication.
- \[2026-01-09 15:32:00] | File: .env.example (POS) | Line: 21 | Keyword: WEBSITE_SYNC | Status: Edited | Change: Added WEBSITE_SYNC_URL and WEBSITE_SYNC_SECRET configuration.
- \[2026-01-09 15:33:00] | File: .env.example (SiteRestaurant) | Line: 1 | Keyword: SYNC_SECRET | Status: Created | Change: Created .env.example with SYNC_SECRET for webhook authentication.
- \[2026-01-09 15:34:00] | File: MenuManagement.jsx | Line: 28 | Keyword: handleSyncToWebsite | Status: Created | Change: Added Manual Sync button with loading state and toast notification.

## 🎛️ Global Options System (Category-level Options)

### 2026-01-09
- \[2026-01-09 16:25:00] | File: db_pg.js | Line: 724 | Keyword: global_options | Status: Created | Change: Added Migration 15 for global_options table.
- \[2026-01-09 16:25:00] | File: db_pg.js | Line: 746 | Keyword: global_option_categories | Status: Created | Change: Added Migration 16 for junction table linking options to categories.
- \[2026-01-09 16:26:00] | File: server.js (electron) | Line: 772-892 | Keyword: /api/global-options | Status: Created | Change: Added CRUD API endpoints for Global Options with category relationships.
- \[2026-01-09 16:27:00] | File: api.js | Line: 362 | Keyword: getGlobalOptions | Status: Created | Change: Added frontend API functions for Global Options CRUD.
- \[2026-01-09 16:28:00] | File: MenuManagement.jsx | Line: 14 | Keyword: globalOptions state | Status: Created | Change: Added state variables for Global Options management.
- \[2026-01-09 16:29:00] | File: MenuManagement.jsx | Line: 345 | Keyword: global-options tab | Status: Created | Change: Added "Global Options" Tab button in navigation.
- \[2026-01-09 16:30:00] | File: MenuManagement.jsx | Line: 530-617 | Keyword: global-options section | Status: Created | Change: Added Global Options listing with category badges and action buttons.
- \[2026-01-09 16:31:00] | File: MenuManagement.jsx | Line: 1048 | Keyword: showGlobalOptionModal | Status: Created | Change: Added Modal for creating/editing Global Options with category checkboxes.
- \[2026-01-09 16:48:00] | File: db_pg.js | Line: 782 | Keyword: global_option_recipes | Status: Created | Change: Added Migration 17 to create global_option_recipes table for option-specific ingredients.
- \[2026-01-09 16:49:00] | File: server.js (electron) | Line: 894 | Keyword: /api/global-option-recipes | Status: Created | Change: Added API endpoints to Fetch/Save ingredients for global options.
- \[2026-01-09 16:50:00] | File: api.js | Line: 391 | Keyword: saveGlobalOptionRecipe | Status: Created | Change: Added frontend wrapper functions for Global Option Recipe API.
- \[2026-01-09 16:52:00] | File: MenuManagement.jsx | Line: 1142 | Keyword: Recipe Configuration | Status: Edited | Change: Added ingredient selector and quantity inputs to Global Option Modal.
- \[2026-01-09 16:53:00] | File: MenuManagement.jsx | Line: 530 | Keyword: JSX Syntax | Status: Fixed | Change: Fixed invalid comment syntax in JSX ternary operator that caused build failure.
- \[2026-01-09 17:05:00] | File: db_pg.js | Line: 783 | Keyword: ERR_REQUIRE_ASYNC_MODULE | Status: Fixed | Change: Solved top-level await error by moving Migration 17 inside initDatabasePG function.
- \[2026-01-09 17:15:00] | File: server.js | Line: 219 | Keyword: processStockDeduction | Status: Modified | Change: Updated logic to detect is_global flag and deduct stock from global_options table correctly.
- \[2026-01-09 17:20:00] | File: OrderEntry.jsx | Line: 190 | Keyword: Global Options Display | Status: Implemented | Change: Added logic to fetch Global Options and filter by category in POS UI.
- \[2026-01-09 17:25:00] | File: OrderEntry.jsx | Line: 200 | Keyword: is_global | Status: Implemented | Change: Pass is_global flag when adding global items to cart/modal.
- \[2026-01-09 17:35:00] | File: server.js | Line: 905 | Keyword: API Response Format | Status: Fixed | Change: Fixed /api/global-option-recipes/:optionId to return result.rows array instead of full PG object, resolving frontend crash.
- \[2026-01-09 17:40:00] | File: MenuManagement.jsx | Line: 1182 | Keyword: ingredients variable | Status: Fixed | Change: Changed 'ingredients' to 'allIngredients' to match existing state variable name, fixing ReferenceError.
- \[2026-01-09 18:00:00] | File: db_pg.js | Line: 775 | Keyword: Migration 18 | Status: Added | Change: Added Migration 18 to add `is_recommended` column to `products` table.
- \[2026-01-09 18:05:00] | File: server.js | Line: 596 | Keyword: Product API | Status: Modified | Change: Updated POST and PUT /api/products to handle `is_recommended` field.
- \[2026-01-09 18:10:00] | File: MenuManagement.jsx | Line: 716 | Keyword: Recommended Toggle | Status: Implemented | Change: Added Toggle Switch in Product Modal to manage `is_recommended` status.
- \[2026-01-09 18:25:00] | File: OrderEntry.jsx | Line: 605 | Keyword: Recommended Filter | Status: Implemented | Change: Added "Recommended" filter button to Order Entry UI, filtering by `is_recommended` flag instead of category ID.
- \[2026-01-09 18:40:00] | File: db_pg.js | Line: 790 | Keyword: Migration 19 | Status: Added | Change: Added Migration 19 to `order_item_options` to support `global_option_id` and make `option_id` nullable.
- \[2026-01-09 18:45:00] | File: server.js | Line: 1040 | Keyword: Global Option Order | Status: Fixed | Change: Updated POST /api/orders to insert Global Options into `order_item_options` using `global_option_id` and `is_global` flag.
- \[2026-01-09 19:15:00] | File: KitchenDisplay.jsx | Line: 76 | Keyword: KDS Global Recipe | Status: Fixed | Change: Updated KDS to fetch recipes for Global Options using `api.getGlobalOptionRecipe` when `is_global` flag is present.
- \[2026-01-09 19:40:00] | File: server.js | Line: 3580 | Keyword: Takeaway Options | Status: Fixed | Change: Updated `POST /api/public/delivery-orders` to save `items_json` in `line_orders` table, ensuring Global Options are preserved.


## 🚀 Next Steps
1. **Final User Acceptance:** Ask Papa to test the new Area Zones in his layout.
2. **Performance Review:** Monitor DB transaction performance under load.
- \[2026-01-08 01:47:00] | File: dist_exe/POS-2025 Setup 0.0.0.exe | Line: 0 | Keyword: electron-builder | Status: Created | Change: Successfully built Windows Installer using automated dist pipeline.
- \[2026-01-08 02:00:00] | File: scripts/reset_orders.js | Line: 0 | Keyword: TRUNCATE | Status: Created | Change: Created utility script to drop/clear all order-related data (orders, line_orders, notifications) and reset table statuses.

- \[2026-01-09 16:30:00] | File: server.js | Line: 390 | Keyword: syncMenuToWebsite | Status: Modified | Change: Updated sync output to include unavailable (Sold Out) items so website can display them with badges.
- \[2026-01-09 16:35:00] | File: api.js | Line: 282 | Keyword: syncMenu | Status: Created | Change: Added manual sync API call to frontend service.
- \[2026-01-09 16:40:00] | File: MenuManagement.jsx | Line: 44 | Keyword: handleSyncToWebsite | Status: Refactored | Change: Refactored Sync button handler to use unified api.syncMenu() service.
- \[2026-01-10 00:35:00] | File: electron/db_pg.js | Line: 666 | Keyword: Migration 20 | Status: Modified | Change: Added Migration 20 to loyalty_customers table (nickname, birthdate, search_keywords) for CRM features.

## 🎂 Auto-Birthday Reward System (Plan 2)

### 2026-01-10
- \[2026-01-10 13:35:00] | File: electron/db_pg.js | Line: 830 | Keyword: Migration 21 | Status: Created | Change: Added Migration 21 for Birthday System (birthday_reward_sent_year, coupon_type, discount_type, discount_value, min_order_amount).
- \[2026-01-10 13:36:00] | File: electron/birthdayScheduler.js | Line: 0 | Keyword: birthdayScheduler | Status: Created | Change: Created Birthday Scheduler module with node-cron (9AM daily), LINE Flex Message, and coupon generation.
- \[2026-01-10 13:37:00] | File: electron/server.js | Line: 11 | Keyword: import | Status: Edited | Change: Added import for birthdayScheduler module.
- \[2026-01-10 13:37:00] | File: electron/server.js | Line: 80 | Keyword: initBirthdayScheduler | Status: Created | Change: Initialize birthday scheduler on server start with pool and io.
- \[2026-01-10 13:38:00] | File: electron/server.js | Line: 500 | Keyword: /api/admin/trigger-birthday-check | Status: Created | Change: Added Admin API for manual birthday check trigger.
- \[2026-01-10 13:38:00] | File: electron/server.js | Line: 520 | Keyword: /api/admin/birthday-customers | Status: Created | Change: Added Admin API to list customers with birthdays this month.
- \[2026-01-10 13:38:00] | File: electron/server.js | Line: 555 | Keyword: /api/admin/birthday-coupons | Status: Created | Change: Added Admin API to list all birthday coupons.

## 🎣 Win-Back System (Plan 3)

### 2026-01-10
- \[2026-01-10 15:16:00] | File: electron/db_pg.js | Line: 855 | Keyword: Migration 22 | Status: Created | Change: Added Migration 22 for Win-Back System (last_order_at, winback_sent_at columns in loyalty_customers).
- \[2026-01-10 15:16:00] | File: electron/db_pg.js | Line: 875 | Keyword: winback_settings | Status: Created | Change: Added default settings (winback_inactive_days, winback_discount_percent, winback_cooldown_days, winback_coupon_valid_days).
- \[2026-01-10 15:17:00] | File: electron/winbackScheduler.js | Line: 0 | Keyword: winbackScheduler | Status: Created | Change: Created Win-Back Scheduler module with node-cron (10AM daily), LINE Flex Message, and coupon generation for inactive customers.
- \[2026-01-10 15:18:00] | File: electron/server.js | Line: 12 | Keyword: import | Status: Edited | Change: Added import for winbackScheduler module.
- \[2026-01-10 15:18:00] | File: electron/server.js | Line: 84 | Keyword: initWinbackScheduler | Status: Created | Change: Initialize win-back scheduler on server start with pool and io.
- \[2026-01-10 15:19:00] | File: electron/server.js | Line: 588 | Keyword: /api/admin/trigger-winback-check | Status: Created | Change: Added Admin API for manual win-back check trigger.
- \[2026-01-10 15:19:00] | File: electron/server.js | Line: 606 | Keyword: /api/admin/inactive-customers | Status: Created | Change: Added Admin API to list inactive customers (potential win-back targets).
- \[2026-01-10 15:19:00] | File: electron/server.js | Line: 653 | Keyword: /api/admin/winback-coupons | Status: Created | Change: Added Admin API to list all win-back coupons.
- \[2026-01-10 15:20:00] | File: electron/server.js | Line: 122 | Keyword: earnLoyaltyPoints | Status: Edited | Change: Updated to also set last_order_at for Win-Back System tracking.

## 🛡️ Security Hardening & Audit (Rule 23 Implementation)

### 2026-01-10
- \[2026-01-10 15:45:00] | File: .env.example | Line: 32 | Keyword: ADMIN_SECRET_KEY | Status: Created | Change: Added security configuration placeholder for admin access.
- \[2026-01-10 15:46:00] | File: electron/server.js | Line: 35 | Keyword: CORS Policy | Status: Edited | Change: Tightened CORS to allow only specific origins (Localhost/Electron) in production.
- \[2026-01-10 15:46:00] | File: electron/server.js | Line: 51 | Keyword: requireAdmin | Status: Created | Change: Implemented Authorization middleware using X-Admin-Secret header check.
- \[2026-01-10 15:48:00] | File: electron/server.js | Line: 506+ | Keyword: API Security | Status: Edited | Change: Secured 30+ Admin/Sensitive endpoints (Products, Categories, Orders, Promotions, Dashboard, Riders) with requireAdmin middleware.
- \[2026-01-10 15:50:00] | File: electron/server.js | Line: 699 | Keyword: Debug Security | Status: Edited | Change: Disabled /api/debug/schema in production mode to prevent schema leakage.
- \[2026-01-10 16:05:00] | File: electron/server.js | Line: 33 | Keyword: CORS Policy | Status: Edited | Change: Optimized CORS to dynamically allow Local IP and Electron production origins.
- \[2026-01-10 16:05:00] | File: electron/server.js | Line: 56 | Keyword: requireAdmin | Status: Edited | Change: Improved requirement to allow local access in dev mode and strictly check secret in prod.
- \[2026-01-10 16:10:00] | File: src/services/api.js | Line: 17 | Keyword: API Helpers | Status: Refactored | Change: Refactored all API calls to use centralized helpers that include the X-Admin-Secret header.
- \[2026-01-10 16:15:00] | File: electron/server.js | Line: 15 | Keyword: fix initialization | Status: Edited | Change: Moved getLocalIp to top-level to fix ReferenceError during server start.
- \[2026-01-10 16:20:00] | File: electron/server.js | Line: 92 | Keyword: requireAdmin | Status: Edited | Change: Fixed 401 Unauthorized on Render production by allowing same-origin requests with default key.
- \[2026-01-10 16:35:00] | File: electron/server.js | Line: 58 | Keyword: CORS Policy | Status: Edited | Change: Updated CORS to allow LINE LIFF domains, Render domains, and any 192.168/10.x LAN addresses for cross-device access.
- \[2026-01-10 16:40:00] | File: electron/server.js | Line: Multiple | Keyword: Security Audit | Status: Edited | Change: Removed requireAdmin from 8 staff-facing endpoints (orders, dashboard, riders, coupons) that were incorrectly restricted.
- \[2026-01-10 16:55:00] | File: electron/server.js | Line: Multiple | Keyword: Notification System | Status: Created | Change: Added comprehensive notifications for 12 events: orders, payment, kitchen, delivery, member, and coupon.
- \[2026-01-10 17:15:00] | File: electron/server.js | Line: 3163 | Keyword: Coupon Logic | Status: Edited | Change: Fixed bug where coupon applied but not marked used. Added strict rowCount check and rollback on failure. Added 'coupon' notification.


## 🎫 LINE Order Coupon Integration
### 2026-01-10
- \[2026-01-10 18:00:00] | File: electron/server.js | Line: 2827 | Keyword: GET /api/line_orders | Status: Modified | Change: Fixed 500 Error by correcting SQL query to JOIN loyalty_promotions for coupon title/description retrieval.
- \[2026-01-10 18:05:00] | File: src/LineOrderManagement.jsx | Line: 335 | Keyword: Coupon Display | Status: Modified | Change: Added 'Applied Coupon' indicator and detail block to Order Card and Modal for staff visibility.
- \[2026-01-10 18:10:00] | File: electron/server.js | Line: 3020 | Keyword: sendLineFlexMessage | Status: Modified | Change: Updated LINE notification to include Coupon details in the customer confirmation message.
- \[2026-01-10 18:12:00] | File: src/OrderEntry.jsx | Line: 1201 | Keyword: Syntax Fix | Status: Fixed | Change: Fixed malformed ternary operator syntax in QR Payment Modal preventing rendering.
- \[2026-01-10 18:38:00] | File: electron/server.js | Line: 3049 | Keyword: sendLineFlexMessage | Status: Modified | Change: Updated LINE notification to show coupon_code alongside title so customers know which coupon was used.
- \[2026-01-10 18:39:00] | File: electron/server.js | Line: 2839 | Keyword: GET /api/line_orders | Status: Modified | Change: Added debug logging to track which orders have linked coupons.
- \[2026-01-10 18:41:00] | File: src/OrderEntry.jsx | Line: 9 | Keyword: FaGift import | Status: Fixed | Change: Added missing `FaGift` import from react-icons/fa to fix ReferenceError during checkout.
- \[2026-01-10 18:43:00] | File: src/OrderEntry.jsx | Line: 1043 | Keyword: Loyalty Customer Display | Status: Created | Change: Added Loyalty Member info block in Payment Modal to show linked customer name, picture, and member badge for staff view.
- \[2026-01-10 18:49:00] | File: electron/db_pg.js | Line: 894 | Keyword: Migration 24 | Status: Created | Change: Added migration to drop FK constraint on `order_item_options.option_id` and add `global_option_id` column to support Global Options in Takeaway orders.
- \[2026-01-10 19:02:00] | File: src/OrderEntry.jsx | Line: 1164 | Keyword: Payment Method Selector | Status: Created | Change: Added missing Cash/QR toggle buttons in Payment Modal to restore payment method selection.
- \[2026-01-10 19:05:00] | File: electron/db_pg.js | Line: 913 | Keyword: Migration 25 | Status: Created | Change: Added migration for `coupon_code` and `coupon_details` columns in orders table.
- \[2026-01-10 19:05:00] | File: electron/server.js | Line: 3442 | Keyword: Takeaway Active Orders | Status: Modified | Change: Endpoint `/api/orders/takeaway/active` now includes item options in response.
- \[2026-01-10 19:50:00] | File: src/LineOrderManagement.jsx | Line: 32 | Keyword: loadOrders | Status: Modified | Change: Mapped coupon_details to applied_coupon to fix display issue. Changed 'Cash' label to 'ชำระเงิน'.
- \[2026-01-10 19:50:00] | File: src/OrderEntry.jsx | Line: 959 | Keyword: UI Text | Status: Modified | Change: Changed 'เงินสด' to 'ชำระเงิน' in payment selector.
- \[2026-01-10 19:56:00] | File: src/OrderEntry.jsx | Line: 970 | Keyword: UI Cleanup | Status: Modified | Change: Removed redundant 'Scan QR' button from payment method selector.
- \[2026-01-10 19:56:00] | File: src/LineOrderManagement.jsx | Line: 726 | Keyword: QR Display | Status: Fixed | Change: Added fallback warning if PromptPay number is missing, allowing staff to investigate why QR is not showing.
- \[2026-01-10 20:00:00] | File: src/LineOrderManagement.jsx | Line: 47 | Keyword: Settings Parsing | Status: Fixed | Change: Fixed settings data parsing (Array -> Object) so settings.promptpay_number is correctly read.
- \[2026-01-10 20:10:00] | File: src/LineOrderManagement.jsx | Line: 742 | Keyword: QR Visibility | Status: Fixed | Change: Removed animation classes, enforced String type for PromptPay number, and set white background to ensure QR visibility.
- \[2026-01-10 20:15:00] | File: src/LineOrderManagement.jsx | Line: 742 | Keyword: Syntax Fix | Status: Fixed | Change: Corrected malformed nested ternary operator that was causing build error.
- \[2026-01-10 20:25:00] | File: src/OrderEntry.jsx | Line: 1184 | Keyword: Missing QR Display | Status: Fixed | Change: Implemented QR Code display logic in the Confirmation Payment Modal (OrderEntry.jsx) which was previously missing. Added settings loading and state managment.
- \[2026-01-10 20:30:00] | File: src/OrderEntry.jsx | Line: 438 | Keyword: Duplicate Clean | Status: Fixed | Change: Removed duplicate 'settings' declaration and old useEffect to prevent build error.
- \[2026-01-10 19:12:00] | File: src/pages/LineOrder.jsx | Line: 267 | Keyword: getCouponDiscountAmount | Status: Modified | Change: Added 'ราคา XX.-' pattern, check discount_amount first, use LAST number as fallback.
- \[2026-01-10 19:12:00] | File: src/LineOrderManagement.jsx | Line: 209 | Keyword: getCouponDiscount | Status: Modified | Change: Same coupon parsing fixes applied.
 
- \[2026-01-10 20:40:00] | File: electron/server.js | Line: 1608 | Keyword: Pay Endpoint | Status: Modified | Change: Updated ACTIVE pay endpoint to accept paidAmount and discountAmount. Updated total_amount to be the Net Amount.
- \[2026-01-10 20:40:00] | File: electron/server.js | Line: 3464 | Keyword: Duplicate Clean | Status: Deleted | Change: Removed the DUPLICATE and inactive /api/orders/:id/pay endpoint to prevent confusion.
- \[2026-01-10 20:40:00] | File: electron/server.js | Line: 3637 | Keyword: Line Order Pay | Status: Modified | Change: Updated Line Order payment logic to update total_amount with paidAmount (Net).
- \[2026-01-10 20:45:00] | File: src/OrderEntry.jsx | Line: 516 | Keyword: Net Amount Payment | Status: Modified | Change: Updated api.payOrder call to include paidAmount: finalToPay so server saves the Net Amount.

- \[2026-01-10 20:45:00] | File: src/LineOrderManagement.jsx | Line: 140 | Keyword: Net Amount Payment | Status: Modified | Change: Updated payment fetch call to include paidAmount: finalAmount.
- \[2026-01-10 21:48:00] | File: PROJECT_LOG.md | Line: 35, 167 | Keyword: Markdown Lint Fix | Status: Modified | Change: Fixed list formatting and escaped square brackets in timestamps to resolve lint warnings.
- \[2026-01-10 21:48:00] | File: index.html | Line: 9 | Keyword: Meta Tag | Status: Modified | Change: Added mobile-web-app-capable meta tag to fix deprecation warning.
- \[2026-01-10 21:48:00] | File: src/components/AnalyticsDashboard.jsx | Line: 47, 108 | Keyword: Recharts Warning | Status: Modified | Change: Added minHeight to ResponsiveContainer to prevent width/height calculation warnings.
- \[2026-01-10 21:48:00] | File: src/services/api.js | Line: 10 | Keyword: WebSocket Config | Status: Modified | Change: Forced Socket.io to use port 3000 in dev mode to fix connection errors.
- \[2026-01-11 13:24:00] | File: src/layouts/MasterLayout.jsx | Line: 41 | Keyword: Notification Sound | Status: Modified | Change: Added audio notification for order-related notifications (order, bill, takeaway, delivery, kitchen, payment). Coupon/member/info notifications excluded.
- \[2026-01-11 19:30:00] | File: electron/db_pg.js | Line: 926 | Keyword: Migration 26 | Status: Created | Change: Added coupon_code, coupon_discount, original_amount columns to line_orders table.
- \[2026-01-11 19:30:00] | File: electron/server.js | Line: 3220 | Keyword: LINE Order Insert | Status: Modified | Change: Updated INSERT query to save coupon data (coupon_code, coupon_discount, original_amount).
- \[2026-01-11 19:30:00] | File: electron/server.js | Line: 3053 | Keyword: sendLineFlexMessage | Status: Modified | Change: Updated Flex Message to show original amount and discount when coupon applied.
- \[2026-01-11 19:30:00] | File: src/LineOrderManagement.jsx | Line: 540, 366 | Keyword: Coupon Display | Status: Modified | Change: Added discount info display in Order Detail Modal and Order Card.
- \[2026-01-11 19:54:00] | File: electron/server.js | Line: 2840 | Keyword: API line_orders | Status: Modified | Change: Fixed coupon data retrieval to use new columns first, fallback to legacy JOIN.
- \[2026-01-11 19:54:00] | File: src/LineOrderManagement.jsx | Line: 536 | Keyword: Item Price | Status: Modified | Change: Fixed item price calculation to include options price_modifier.
- \[2026-01-11 20:05:00] | File: electron/server.js | Line: 3225 | Keyword: Coupon Discount | Status: Modified | Change: Improved discount calculation to use discount_value column first, then fallback to multiple regex patterns (ลด, %, ราคา, number).
- \[2026-01-11 23:36:00] | File: electron/db_pg.js | Line: 939 | Keyword: Migration 27 | Status: Created | Change: Added discount_type and discount_value columns to loyalty_promotions table.
- \[2026-01-11 23:36:00] | File: electron/server.js | Line: 4421 | Keyword: POST Promotions | Status: Modified | Change: Updated API to accept and save discountType and discountValue.
- \[2026-01-11 23:36:00] | File: electron/server.js | Line: 4440 | Keyword: PUT Promotions | Status: Modified | Change: Updated API to accept and save discountType and discountValue.
- \[2026-01-11 23:36:00] | File: electron/server.js | Line: 4320 | Keyword: Redeem Coupon | Status: Modified | Change: Copy discount_type and discount_value from promotion to coupon.
- \[2026-01-11 23:36:00] | File: src/pages/Promotions.jsx | Line: 15,40,80,226 | Keyword: Discount UI | Status: Modified | Change: Added discount type dropdown and value input in promotion form.
- \[2026-01-11 23:41:00] | File: electron/server.js | Line: 3230 | Keyword: Coupon Processing | Status: Modified | Change: Added handling for fixed_price discount type (customer pays only fixed amount).
- \[2026-01-11 23:44:00] | File: src/OrderEntry.jsx | Line: 459 | Keyword: Coupon Discount | Status: Modified | Change: Added support for discount_type + discount_value system (fixed, percent, fixed_price).
- \[2026-01-11 23:44:00] | File: src/pages/LineOrder.jsx | Line: 267 | Keyword: getCouponDiscountAmount | Status: Modified | Change: Added support for discount_type + discount_value system (fixed, percent, fixed_price).
- \[2026-01-12 14:00:00] | File: src/pages/LineOrder.jsx | Line: 375 | Keyword: Double Discount Fix | Status: Modified | Change: Updated submitOrder to send cartAmt (Gross) instead of finalTotal (Net) to prevent backend from double-discounting.
- \[2026-01-12 14:00:00] | File: electron/server.js | Line: 3270 | Keyword: Deposit Calculation | Status: Modified | Change: Moved deposit calculation to AFTER coupon deduction and used finalTotal (Net) as base.
- \[2026-01-12 14:15:00] | File: task.md | Line: 1 | Keyword: Easy LINE Integration | Status: Created | Change: Created task list for SaaS-style LINE configuration.
- \[2026-01-12 14:20:00] | File: electron/server.js | Line: 2914 | Keyword: Admin LINE Settings | Status: Created | Change: Added POST /api/admin/line/settings endpoint to save LINE keys to DB.
- \[2026-01-12 14:20:00] | File: electron/server.js | Line: 2950 | Keyword: Dynamic Token | Status: Modified | Change: Refactored sendLineFlexMessage to fetch access token from DB settings.
- \[2026-01-12 14:40:00] | File: src/components/settings/LineConnectSettings.jsx | Line: 1 | Keyword: Admin UI | Status: Created | Change: Created LINE settings form with Guide Modal for finding Channel Keys.
- \[2026-01-12 14:45:00] | File: src/Settings.jsx | Line: 5, 24, 62, 304 | Keyword: Integration | Status: Modified | Change: Integrated LineConnectSettings component and updated handleSave to persist LINE keys via API.
- \[2026-01-12 14:55:00] | File: electron/server.js | Line: 2980 | Keyword: Auto-Setup | Status: Created | Change: Implemented POST /api/admin/line/setup-richmenu to automate Rich Menu creation and image upload.
- \[2026-01-12 14:58:00] | File: src/components/settings/LineConnectSettings.jsx | Line: 4 | Keyword: One-Click Setup | Status: Modified | Change: Added logic to trigger Auto-Setup with 1-click, including auto-save of settings.
- \[2026-01-12 15:15:00] | File: src/Settings.jsx | Line: 126 | Keyword: Hybrid Mode | Status: Modified | Change: Added Optional Loyalty LIFF ID input to support existing separate Order/Loyalty apps.
- \[2026-01-12 16:45] | File: src/layouts/MasterLayout.jsx | Line: 227 | Keyword: NavLink | Status: Fixed | Change: Updated broken '/promotions' link to '/admin/promotions'
- \[2026-01-12 16:45] | File: src/components/AnalyticsDashboard.jsx | Line: 46, 107 | Keyword: w-full | Status: Fixed | Change: Added w-full to chart containers
- \[2026-01-12 16:50] | File: src/App.jsx | Line: 127 | Keyword: Navigate | Status: Fixed | Change: Added redirect rule for '/promotions' -> '/admin/promotions'
- \[2026-01-12 17:30] | File: src/OrderEntry.jsx | Line: 469 | Keyword: Bug Fix | Status: Fixed | Change: Fixed duplicate 'couponDiscount' declaration
- \[2026-01-12 17:35] | File: src/pages/Promotions.jsx | Line: 56, 23 | Keyword: Refactor | Status: Optimized | Change: Refactored modal UI for compactness and fixed key duplicates
- \[2026-01-12 17:30] | File: src/pages/Promotions.jsx | Line: 1 | Keyword: Admin UI | Status: Created | Change: Created promotions page with basic structure and table display

- \[2026-01-12 18:28] | File: src/components/settings/LineConnectSettings.jsx | Line: 180 | Keyword: Refactor | Status: Fixed | Change: Moved GuideModal component definition before usage to prevent ReferenceError (use-before-define).
- \[2026-01-12 18:28] | File: src/components/settings/LineConnectSettings.jsx | Line: 189 | Keyword: Security | Status: Fixed | Change: Added rel="noopener noreferrer" to external LINE Developer Console links.
- \[2026-01-12 18:28] | File: src/components/settings/LineConnectSettings.jsx | Line: 29 | Keyword: API Safety | Status: Fixed | Change: Passed empty object {} to api.post body for robust backend handling.
- \[2026-01-12 21:00] | File: src/Settings.jsx | Line: 167 | Keyword: Website Sync UI | Status: Created | Change: Added UI fields for website_sync_url and website_sync_secret in General Settings.
- \[2026-01-12 21:05] | File: electron/server.js | Line: 456 | Keyword: Sync Logic | Status: Modified | Change: Updated syncMenuToWebsite to prioritize DB settings over ENV variables.
- \[2026-01-12 21:15] | File: src/Settings.jsx | Line: 144, 295 | Keyword: UI Enhancement | Status: Modified | Change: Refactored General and Payment inputs with icons, better padding, and consistent focus states.
- \[2026-01-12 21:25] | File: src/Settings.jsx | Line: 144, 295 | Keyword: UI Padding | Status: Modified | Change: Added p-8 padding to tasty-card containers for better spacing.
- \[2026-01-12 21:26] | File: src/Settings.jsx | Line: 167 | Keyword: Facebook Feature | Status: Added | Change: Integrated FacebookConnectSettings into the main Settings tabs.
- \[2026-01-12 21:26] | File: src/components/settings/FacebookConnectSettings.jsx | Line: 1 | Keyword: Facebook UI | Status: Created | Change: Implemented comprehensive Facebook Page settings UI with Page ID, Access Token, and Verify Token fields.
- \[2026-01-12 21:26] | File: src/components/settings/FacebookConnectSettings.jsx | Line: 3 | Keyword: Setup Guide | Status: Created | Change: Built an interactive 5-step Setup Guide Modal to walk users through the Meta Developer Console configuration.
- \[2026-01-12 21:27] | File: C:/Users/Venge/.gemini/antigravity/brain/3d40f57f-566d-4d42-88be-2aa8df9c8530/facebook_setup_guide.md | Line: 1 | Keyword: Documentation | Status: Created | Change: Created detailed Facebook Setup Guide artifact for reference.
- \[2026-01-12 21:45] | File: src/Settings.jsx | Line: 87 | Keyword: UI Icons | Status: Modified | Change: Replaced emoji icons with official FaLine and FaFacebook brand icons in Settings tabs.
- \[2026-01-13 02:58] | File: electron/server.js | Line: 2710 | Keyword: Facebook Webhook | Status: Created | Change: Implemented complete Facebook Webhook Logic (GET verification + POST message handling).
- \[2026-01-13 03:07] | File: electron/server.js | Line: 2768 | Keyword: Chatbot Logic | Status: Modified | Change: Added Rule-Based Logic (Stock Check from DB, Store Hours from Settings, Menu Recommendation).
- \[2026-01-13 03:13] | File: electron/server.js | Line: 2828 | Keyword: Chatbot Intelligence | Status: Enhanced | Change: Added 4 new skills: Check Queue (Orders), Check Price (Products), Payment Info, and WiFi Password.
