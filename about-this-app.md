# About This App: SaaS ERP & Inventory Management System

This application is a comprehensive, multi-tenant SaaS Enterprise Resource Planning (ERP) and Inventory Management system. It is designed to handle the complex daily operations of various businesses, with a specialized, highly detailed module for hardware and construction material shops (specifically TMT/Rebar businesses). 

Built on a modern tech stack (Next.js, Prisma, CockroachDB/PostgreSQL, Redis) and utilizing a robust role-based access control system, it serves both the **Platform Owners** (who manage the SaaS offerings) and the **Shop Owners** (who run their businesses on the platform).

Here is a detailed breakdown of what this ERP system does and everything it manages:

---

## 1. Multi-Tenant SaaS Platform Management
The system is built to serve multiple businesses (Shops/Tenants) simultaneously while keeping their data strictly isolated.
* **Platform Administration:** Super admins and platform owners can manage all shops on the network, view global platform analytics, and manage "Website Settings" for SEO and branding.
* **Subscription & Billing:** Handles shop subscriptions (Trial, Basic, Professional, Enterprise). It tracks subscription status, auto-renewal, limits, usage metrics, and processes payments via gateways like Stripe and Razorpay.
* **Violation & Moderation:** A system for platform owners to track violations (e.g., terms violation, payment failure) reported against shops, including severities, evidence tracking, and resolution workflows.
* **Notification Engine:** Sends automated alerts for subscription expiries, payment dues, system maintenance, and user activity.

## 2. Core Business & Shop Management
At the tenant level, every Shop manages its own independent ecosystem.
* **Shop Profiles:** Basic shop details including name, location, GST numbers, and contact information.
* **Employee & HR Management:** Tracks employees, positions, join dates, fixed salaries. Manages employee payments and tracks pending "Salary Dues."
* **Expense Tracking:** Records daily operational expenses categorized under Rent, Electricity, Maintenance, Salary, Marketing, etc.
* **Business Goals & Metrics:** Allows shop owners to set target values (e.g., monthly sales targets) and tracks recorded business metrics with custom formulas over specific periods.

## 3. General Inventory System
A robust module for tracking standard retail/wholesale products.
* **Product Hierarchy:** Organized by `Product Category` (e.g., Electronics) -> `Product Type` (e.g., Smartphones) -> `Product` (e.g., iPhone 15).
* **Detailed Product Attributes:** Tracks SKU, barcode, buying/cost price, selling price, unit types, and stock quantities (including damaged stock).
* **Smart Stock Alerts:** Maintains Minimum and Maximum stock levels to prevent stockouts or overstocking.
* **Daily Pricing:** Supports dynamic `DailyProductPrice` tracking, allowing costs to fluctuate day-by-day.

## 4. Specialized TMT (Rebar/Construction) Inventory Module
A highly specialized, distinct subset of inventory designed specifically for construction material businesses handling steel bars (TMT).
* **TMT Hierarchy:** Organized by `TmtCompany` (Brand) -> `TmtSize` (e.g., 8mm, 10mm, 12mm) -> `TmtProduct`.
* **Complex Unit Conversions:** Automatically handles the intricate math between different units: Total Weight (Tons/Kg) <-> Bundles <-> Pieces.
* **Detailed Dimensions:** Tracks weight per rod (kg), rods per bundle, and weight per bundle (kg).
* **TMT Purchasing & Sales:** Specialized invoicing for buying in Tons/Kg and selling in Pieces/Bundles, automatically calculating the equivalent metrics.

## 5. Sales & Point of Sale (POS)
Manages the outward flow of goods to customers.
* **Invoicing & Checkout:** Calculates total amount, handles discounts, and determines final payable amounts.
* **Payment Processing:** Supports splitting payments or tracking statuses (Pending, Completed, Cancelled, Refunded, Partial). Accepts Multiple Methods: Cash, Card, UPI, Bank Transfer, Cheque.
* **Dual Sales Engines:** Distinct workflows for *General Sales* and *TMT Sales* to accommodate the different unit tracking requirements.

## 6. Customer & Relationship Management (CRM)
Deep tracking of customer interactions and credit.
* **Customer Segmentation:** Classifies customers as Regular, Wholesale, Retail, or Contractor.
* **Customer Ledger (Khaata):** A traditional ledger system tracking credit limits and current balances. It meticulously logs every transaction (credit/debit) ensuring no money is lost when offering goods on credit.
* **Special Pricing:** Allows shops to define custom, overridden prices (`CustomerSpecialPrice`) for specific products for loyal or wholesale customers.

## 7. Supplier & Purchase Management
Manages the inward flow of goods and accounts payable.
* **Supplier Profiles:** Tracks vendor contact details and GST numbers.
* **Stock Entries (Purchases):** Records incoming stock, linking the supplier, product, quantity, unit price, and total amount.
* **Supplier Ledgers & Payments:** Tracks how much money is owed to suppliers, logging individual payments.
* **Weekly Reports:** Generates automated weekly summaries for suppliers showing total supplied value, total paid, and outstanding balances.

## 8. Advanced Analytics & Reporting
Gives owners a bird's-eye view of their financial health.
* **Daily/Monthly Summaries:** Aggregates Total Sales, Total Expenses, Net Profit, New Customers, and Inventory movements.
* **Product Sales Analytics:** Tracks which items are moving fast by logging daily quantity sold and revenue per product.
* **Inventory Health Metrics:** Calculates Average Stock, Cost of Goods Sold (COGS), Inventory Turnover Ratio, and Days in Inventory to optimize purchasing decisions.

## 9. Security, Users, & Auditing
Ensures that the data is strictly protected and actions are accountable.
* **Role-Based Access Control (RBAC):** Distinct permissions for Super Duper Admin, Admin, Creator, Platform Owner, User, Staff, and Moderator.
* **Multi-Factor Authentication (2FA):** Enhanced login security via OTP/Authenticator applications.
* **Trusted Devices & Sessions:** Logs IPs, Device Fingerprints, and User Agents (`TrustedDevice`) to prevent unauthorized access. Uses JWTs and tracks successful/failed `LoginLog` attempts.
* **Comprehensive Activity Logs:** An immutable audit trail (`ActivityLog`) that records *who* did *what* to *which resource* and *when*, essential for dispute resolution and employee accountability.

---
**Summary:**
This ERP is a powerhouse application bridging the gap between a standard SaaS billing platform and an intensely granular, industry-specific (Construction/TMT & General Retail) shop management tool. It eliminates the need for separate accounting, HR, CRM, and inventory software by bundling them all into a single, unified, cloud-based ledger and management system.
