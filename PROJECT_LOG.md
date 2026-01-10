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
- [2026-01-07 14:20:32] | File: TablePlan.jsx | Line: 5 | Keyword: import | Status: Edited | Change: Fixed incorrect socket import by using named export from services/api
- [2026-01-07 15:19:45] | File: TableManagement.jsx | Line: 284 | Keyword: updateSelectedItem | Status: Edited | Change: Implemented Hut shape support for tables with fixed 4-seat rule.
- [2026-01-07 15:19:45] | File: TablePlan.jsx | Line: 486 | Keyword: TablePlan | Status: Edited | Change: Integrated Hut visual rendering for tables in Visual Map view.
- [2026-01-07 15:37:31] | File: TableManagement.jsx | Line: 459 | Keyword: addObject | Status: Created | Change: Added Area Zone (Sub-Zone) component to floor plan designer.
- [2026-01-07 15:37:31] | File: TablePlan.jsx | Line: 380 | Keyword: TablePlan | Status: Edited | Change: Implemented low-priority z-index rendering for visual Area Zones with centered labeling.
- [2026-01-07 15:47:00] | File: TableManagement.jsx | Line: 224 | Keyword: addObject | Status: Edited | Change: Fixed 500 Error (NOT NULL constraint) by adding default naming for Area Zones.
- [2026-01-07 15:53:00] | File: TablePlan.jsx | Line: 7 | Keyword: import | Status: Edited | Change: Added missing FaLayerGroup import to fix ReferenceError.
- [2026-01-07 15:53:00] | File: TableManagement.jsx | Line: 545 | Keyword: Properties | Status: Created | Change: Added editable Zone Name input for Area Zones; changed label style to gray/faded.
- [2026-01-07 16:00:00] | File: TableManagement.jsx | Line: 359 | Keyword: viewMode | Status: Hidden | Change: Suspended Visual Editor and Visual Map views due to design rethink; locked to List View.
- [2026-01-08 09:00:00] | File: server.js | Line: 291 | Keyword: getStoreStatus | Status: Created | Change: Implemented store status logic and /api/store-status endpoint.
- [2026-01-08 09:15:00] | File: Settings.jsx | Line: 19 | Keyword: settings | Status: Edited | Change: Added store hours and last order configuration fields.
- [2026-01-08 10:30:00] | File: OrderEntry.jsx | Line: 37 | Keyword: storeStatus | Status: Edited | Change: Integrated status banner and order blocking for POS. Resolved all syntax errors and UI breakage.
- [2026-01-08 11:20:00] | File: LineOrder.jsx | Line: 43 | Keyword: storeStatus | Status: Edited | Change: Integrated business hours validation and UI banner for LINE channel.
- [2026-01-08 11:45:00] | File: TakeawayOrder.jsx | Line: 16 | Keyword: storeStatus | Status: Edited | Change: Integrated business hours validation and UI banner for public Takeaway channel.
- [2026-01-07 19:20:00] | File: LineOrderManagement.jsx | Line: 363 | Keyword: Modal | Status: Edited | Change: Redesigned Order Detail and Payment modals to match "Obsidian & Gold" premium theme.

[2026-01-07 19:30] | File: SalesHistory.jsx | Line: 28 | Keyword: loadHistory | Status: Edited | Change: Added robust data handling and logging for sales history fetching.
- [2026-01-07 19:30:00] | File: server.js | Line: 950 | Keyword: /api/orders/history | Status: Edited | Change: Refined SQL query with explicit timezone handling and decimal-to-float casting for better data integrity.
- [2026-01-07 20:10:00] | File: server.js | Line: 847 | Keyword: /api/orders/history | Status: Edited | Change: Moved history route above generic :tableName route to fix shadowing conflict and added explicit date casting for robust filtering.
- [2026-01-07 20:15:00] | File: server.js | Line: 905 | Keyword: /api/orders/:id | Status: Created | Change: Implemented numeric ID lookup route for order details to resolve blank Sales History modal issues.

## 🔄 Menu Sync Feature (POS → Website)

### 2026-01-09
- [2026-01-09 15:28:00] | File: server.js (electron) | Line: 346 | Keyword: syncMenuToWebsite | Status: Created | Change: Added helper function to push menu data to restaurant website via Webhook.
- [2026-01-09 15:29:00] | File: server.js (electron) | Line: 575-640 | Keyword: products/categories CRUD | Status: Edited | Change: Added auto-sync trigger after all product/category CRUD operations.
- [2026-01-09 15:30:00] | File: server.js (electron) | Line: 650 | Keyword: /api/sync-menu-to-website | Status: Created | Change: Added Manual Sync endpoint for backup synchronization.
- [2026-01-09 15:31:00] | File: server.js (SiteRestaurant) | Line: 454 | Keyword: /api/sync-menu | Status: Created | Change: Added Webhook receiver endpoint with Secret Key authentication.
- [2026-01-09 15:32:00] | File: .env.example (POS) | Line: 21 | Keyword: WEBSITE_SYNC | Status: Edited | Change: Added WEBSITE_SYNC_URL and WEBSITE_SYNC_SECRET configuration.
- [2026-01-09 15:33:00] | File: .env.example (SiteRestaurant) | Line: 1 | Keyword: SYNC_SECRET | Status: Created | Change: Created .env.example with SYNC_SECRET for webhook authentication.
- [2026-01-09 15:34:00] | File: MenuManagement.jsx | Line: 28 | Keyword: handleSyncToWebsite | Status: Created | Change: Added Manual Sync button with loading state and toast notification.

## 🎛️ Global Options System (Category-level Options)

### 2026-01-09
- [2026-01-09 16:25:00] | File: db_pg.js | Line: 724 | Keyword: global_options | Status: Created | Change: Added Migration 15 for global_options table.
- [2026-01-09 16:25:00] | File: db_pg.js | Line: 746 | Keyword: global_option_categories | Status: Created | Change: Added Migration 16 for junction table linking options to categories.
- [2026-01-09 16:26:00] | File: server.js (electron) | Line: 772-892 | Keyword: /api/global-options | Status: Created | Change: Added CRUD API endpoints for Global Options with category relationships.
- [2026-01-09 16:27:00] | File: api.js | Line: 362 | Keyword: getGlobalOptions | Status: Created | Change: Added frontend API functions for Global Options CRUD.
- [2026-01-09 16:28:00] | File: MenuManagement.jsx | Line: 14 | Keyword: globalOptions state | Status: Created | Change: Added state variables for Global Options management.
- [2026-01-09 16:29:00] | File: MenuManagement.jsx | Line: 345 | Keyword: global-options tab | Status: Created | Change: Added "Global Options" Tab button in navigation.
- [2026-01-09 16:30:00] | File: MenuManagement.jsx | Line: 530-617 | Keyword: global-options section | Status: Created | Change: Added Global Options listing with category badges and action buttons.
- [2026-01-09 16:31:00] | File: MenuManagement.jsx | Line: 1048 | Keyword: showGlobalOptionModal | Status: Created | Change: Added Modal for creating/editing Global Options with category checkboxes.
- [2026-01-09 16:48:00] | File: db_pg.js | Line: 782 | Keyword: global_option_recipes | Status: Created | Change: Added Migration 17 to create global_option_recipes table for option-specific ingredients.
- [2026-01-09 16:49:00] | File: server.js (electron) | Line: 894 | Keyword: /api/global-option-recipes | Status: Created | Change: Added API endpoints to Fetch/Save ingredients for global options.
- [2026-01-09 16:50:00] | File: api.js | Line: 391 | Keyword: saveGlobalOptionRecipe | Status: Created | Change: Added frontend wrapper functions for Global Option Recipe API.
- [2026-01-09 16:52:00] | File: MenuManagement.jsx | Line: 1142 | Keyword: Recipe Configuration | Status: Edited | Change: Added ingredient selector and quantity inputs to Global Option Modal.
- [2026-01-09 16:53:00] | File: MenuManagement.jsx | Line: 530 | Keyword: JSX Syntax | Status: Fixed | Change: Fixed invalid comment syntax in JSX ternary operator that caused build failure.
- [2026-01-09 17:05:00] | File: db_pg.js | Line: 783 | Keyword: ERR_REQUIRE_ASYNC_MODULE | Status: Fixed | Change: Solved top-level await error by moving Migration 17 inside initDatabasePG function.
- [2026-01-09 17:15:00] | File: server.js | Line: 219 | Keyword: processStockDeduction | Status: Modified | Change: Updated logic to detect is_global flag and deduct stock from global_options table correctly.
- [2026-01-09 17:20:00] | File: OrderEntry.jsx | Line: 190 | Keyword: Global Options Display | Status: Implemented | Change: Added logic to fetch Global Options and filter by category in POS UI.
- [2026-01-09 17:25:00] | File: OrderEntry.jsx | Line: 200 | Keyword: is_global | Status: Implemented | Change: Pass is_global flag when adding global items to cart/modal.
- [2026-01-09 17:35:00] | File: server.js | Line: 905 | Keyword: API Response Format | Status: Fixed | Change: Fixed /api/global-option-recipes/:optionId to return result.rows array instead of full PG object, resolving frontend crash.
- [2026-01-09 17:40:00] | File: MenuManagement.jsx | Line: 1182 | Keyword: ingredients variable | Status: Fixed | Change: Changed 'ingredients' to 'allIngredients' to match existing state variable name, fixing ReferenceError.
- [2026-01-09 18:00:00] | File: db_pg.js | Line: 775 | Keyword: Migration 18 | Status: Added | Change: Added Migration 18 to add `is_recommended` column to `products` table.
- [2026-01-09 18:05:00] | File: server.js | Line: 596 | Keyword: Product API | Status: Modified | Change: Updated POST and PUT /api/products to handle `is_recommended` field.
- [2026-01-09 18:10:00] | File: MenuManagement.jsx | Line: 716 | Keyword: Recommended Toggle | Status: Implemented | Change: Added Toggle Switch in Product Modal to manage `is_recommended` status.
- [2026-01-09 18:25:00] | File: OrderEntry.jsx | Line: 605 | Keyword: Recommended Filter | Status: Implemented | Change: Added "Recommended" filter button to Order Entry UI, filtering by `is_recommended` flag instead of category ID.
- [2026-01-09 18:40:00] | File: db_pg.js | Line: 790 | Keyword: Migration 19 | Status: Added | Change: Added Migration 19 to `order_item_options` to support `global_option_id` and make `option_id` nullable.
- [2026-01-09 18:45:00] | File: server.js | Line: 1040 | Keyword: Global Option Order | Status: Fixed | Change: Updated POST /api/orders to insert Global Options into `order_item_options` using `global_option_id` and `is_global` flag.
- [2026-01-09 19:15:00] | File: KitchenDisplay.jsx | Line: 76 | Keyword: KDS Global Recipe | Status: Fixed | Change: Updated KDS to fetch recipes for Global Options using `api.getGlobalOptionRecipe` when `is_global` flag is present.
- [2026-01-09 19:40:00] | File: server.js | Line: 3580 | Keyword: Takeaway Options | Status: Fixed | Change: Updated `POST /api/public/delivery-orders` to save `items_json` in `line_orders` table, ensuring Global Options are preserved.


## 🚀 Next Steps
1. **Final User Acceptance:** Ask Papa to test the new Area Zones in his layout.
2. **Performance Review:** Monitor DB transaction performance under load.
- [2026-01-08 01:47:00] | File: dist_exe/POS-2025 Setup 0.0.0.exe | Line: 0 | Keyword: electron-builder | Status: Created | Change: Successfully built Windows Installer using automated dist pipeline.
- [2026-01-08 02:00:00] | File: scripts/reset_orders.js | Line: 0 | Keyword: TRUNCATE | Status: Created | Change: Created utility script to drop/clear all order-related data (orders, line_orders, notifications) and reset table statuses.

- [2026-01-09 16:30:00] | File: server.js | Line: 390 | Keyword: syncMenuToWebsite | Status: Modified | Change: Updated sync output to include unavailable (Sold Out) items so website can display them with badges.
- [2026-01-09 16:35:00] | File: api.js | Line: 282 | Keyword: syncMenu | Status: Created | Change: Added manual sync API call to frontend service.
- [2026-01-09 16:40:00] | File: MenuManagement.jsx | Line: 44 | Keyword: handleSyncToWebsite | Status: Refactored | Change: Refactored Sync button handler to use unified api.syncMenu() service.
- [2026-01-10 00:35:00] | File: electron/db_pg.js | Line: 666 | Keyword: Migration 20 | Status: Modified | Change: Added Migration 20 to loyalty_customers table (nickname, birthdate, search_keywords) for CRM features.

## 🎂 Auto-Birthday Reward System (Plan 2)

### 2026-01-10
- [2026-01-10 13:35:00] | File: electron/db_pg.js | Line: 830 | Keyword: Migration 21 | Status: Created | Change: Added Migration 21 for Birthday System (birthday_reward_sent_year, coupon_type, discount_type, discount_value, min_order_amount).
- [2026-01-10 13:36:00] | File: electron/birthdayScheduler.js | Line: 0 | Keyword: birthdayScheduler | Status: Created | Change: Created Birthday Scheduler module with node-cron (9AM daily), LINE Flex Message, and coupon generation.
- [2026-01-10 13:37:00] | File: electron/server.js | Line: 11 | Keyword: import | Status: Edited | Change: Added import for birthdayScheduler module.
- [2026-01-10 13:37:00] | File: electron/server.js | Line: 80 | Keyword: initBirthdayScheduler | Status: Created | Change: Initialize birthday scheduler on server start with pool and io.
- [2026-01-10 13:38:00] | File: electron/server.js | Line: 500 | Keyword: /api/admin/trigger-birthday-check | Status: Created | Change: Added Admin API for manual birthday check trigger.
- [2026-01-10 13:38:00] | File: electron/server.js | Line: 520 | Keyword: /api/admin/birthday-customers | Status: Created | Change: Added Admin API to list customers with birthdays this month.
- [2026-01-10 13:38:00] | File: electron/server.js | Line: 555 | Keyword: /api/admin/birthday-coupons | Status: Created | Change: Added Admin API to list all birthday coupons.

## 🎣 Win-Back System (Plan 3)

### 2026-01-10
- [2026-01-10 15:16:00] | File: electron/db_pg.js | Line: 855 | Keyword: Migration 22 | Status: Created | Change: Added Migration 22 for Win-Back System (last_order_at, winback_sent_at columns in loyalty_customers).
- [2026-01-10 15:16:00] | File: electron/db_pg.js | Line: 875 | Keyword: winback_settings | Status: Created | Change: Added default settings (winback_inactive_days, winback_discount_percent, winback_cooldown_days, winback_coupon_valid_days).
- [2026-01-10 15:17:00] | File: electron/winbackScheduler.js | Line: 0 | Keyword: winbackScheduler | Status: Created | Change: Created Win-Back Scheduler module with node-cron (10AM daily), LINE Flex Message, and coupon generation for inactive customers.
- [2026-01-10 15:18:00] | File: electron/server.js | Line: 12 | Keyword: import | Status: Edited | Change: Added import for winbackScheduler module.
- [2026-01-10 15:18:00] | File: electron/server.js | Line: 84 | Keyword: initWinbackScheduler | Status: Created | Change: Initialize win-back scheduler on server start with pool and io.
- [2026-01-10 15:19:00] | File: electron/server.js | Line: 588 | Keyword: /api/admin/trigger-winback-check | Status: Created | Change: Added Admin API for manual win-back check trigger.
- [2026-01-10 15:19:00] | File: electron/server.js | Line: 606 | Keyword: /api/admin/inactive-customers | Status: Created | Change: Added Admin API to list inactive customers (potential win-back targets).
- [2026-01-10 15:19:00] | File: electron/server.js | Line: 653 | Keyword: /api/admin/winback-coupons | Status: Created | Change: Added Admin API to list all win-back coupons.
- [2026-01-10 15:20:00] | File: electron/server.js | Line: 122 | Keyword: earnLoyaltyPoints | Status: Edited | Change: Updated to also set last_order_at for Win-Back System tracking.

## 🛡️ Security Hardening & Audit (Rule 23 Implementation)

### 2026-01-10
- [2026-01-10 15:45:00] | File: .env.example | Line: 32 | Keyword: ADMIN_SECRET_KEY | Status: Created | Change: Added security configuration placeholder for admin access.
- [2026-01-10 15:46:00] | File: electron/server.js | Line: 35 | Keyword: CORS Policy | Status: Edited | Change: Tightened CORS to allow only specific origins (Localhost/Electron) in production.
- [2026-01-10 15:46:00] | File: electron/server.js | Line: 51 | Keyword: requireAdmin | Status: Created | Change: Implemented Authorization middleware using X-Admin-Secret header check.
- [2026-01-10 15:48:00] | File: electron/server.js | Line: 506+ | Keyword: API Security | Status: Edited | Change: Secured 30+ Admin/Sensitive endpoints (Products, Categories, Orders, Promotions, Dashboard, Riders) with requireAdmin middleware.
- [2026-01-10 15:50:00] | File: electron/server.js | Line: 699 | Keyword: Debug Security | Status: Edited | Change: Disabled /api/debug/schema in production mode to prevent schema leakage.
- [2026-01-10 16:05:00] | File: electron/server.js | Line: 33 | Keyword: CORS Policy | Status: Edited | Change: Optimized CORS to dynamically allow Local IP and Electron production origins.
- [2026-01-10 16:05:00] | File: electron/server.js | Line: 56 | Keyword: requireAdmin | Status: Edited | Change: Improved requirement to allow local access in dev mode and strictly check secret in prod.
- [2026-01-10 16:10:00] | File: src/services/api.js | Line: 17 | Keyword: API Helpers | Status: Refactored | Change: Refactored all API calls to use centralized helpers that include the X-Admin-Secret header.
- [2026-01-10 16:15:00] | File: electron/server.js | Line: 15 | Keyword: fix initialization | Status: Edited | Change: Moved getLocalIp to top-level to fix ReferenceError during server start.
- [2026-01-10 16:20:00] | File: electron/server.js | Line: 92 | Keyword: requireAdmin | Status: Edited | Change: Fixed 401 Unauthorized on Render production by allowing same-origin requests with default key.
- [2026-01-10 16:35:00] | File: electron/server.js | Line: 58 | Keyword: CORS Policy | Status: Edited | Change: Updated CORS to allow LINE LIFF domains, Render domains, and any 192.168/10.x LAN addresses for cross-device access.
- [2026-01-10 16:40:00] | File: electron/server.js | Line: Multiple | Keyword: Security Audit | Status: Edited | Change: Removed requireAdmin from 8 staff-facing endpoints (orders, dashboard, riders, coupons) that were incorrectly restricted.
- [2026-01-10 16:55:00] | File: electron/server.js | Line: Multiple | Keyword: Notification System | Status: Created | Change: Added comprehensive notifications for 12 events: orders, payment, kitchen, delivery, member, and coupon.

