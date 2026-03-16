# Drive Home - Rent-to-Own Platform

A high-integrity vehicle rent-to-own platform designed to bridge the gap between renting and ownership through automated financial tracking and phased growth.

## 🚀 Project Overview
Drive Home is built on a "Path to Ownership" philosophy. It automates the complex transition from a rental agreement to full vehicle ownership, ensuring 100% financial integrity through real-time auditing and atomic transactions.

## 🛠 Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS 4
- **Database & Auth**: Firebase (Firestore, Firebase Auth)
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React

## 💎 Core Features
- **Automated Ownership Engine**: Real-time balance recalculation and status flipping (RENTED -> OWNED).
- **Digital Title Certificates**: Automated generation of ownership proofs upon contract completion.
- **Admin Command Center**: Comprehensive KPI dashboard with portfolio value tracking and status distribution.
- **System Audit Engine**: Cross-references every payment against contract balances to detect and log "Status Drift".
- **Mobile-First Client App**: Optimized for clients to track their payments and ownership progress on the go.

## 🛡 Security & Integrity
- **Atomic Transactions**: All financial updates are handled via Firestore transactions to prevent data corruption.
- **Strict Security Rules**: Role-based access control (RBAC) protecting PII and administrative functions.
- **Integrity Pulse**: Real-time monitoring of system health with a persistent "Integrity Score".
- **Reconciliation Logs**: Historical audit trail of every system check performed.

## 📂 File Structure
- `/app`: Next.js routes and main dashboard.
- `/components`: Reusable UI components (AuditDashboard, VehicleGrid, etc.).
- `/lib`: Core services (OwnershipService, SystemAuditService, Firebase config).
- `/firestore.rules`: Production-ready security configuration.

## 🚦 Getting Started
1. **Configure Firebase**: Update `firebase-applet-config.json` with your project credentials.
2. **Bootstrap Admin**: The account `haylenik@gmail.com` is pre-configured with administrative privileges.
3. **Run Audit**: Use the Admin Dashboard to run the initial system reconciliation.

## 🔮 Future Roadmap
- **Stripe Connect**: Real-world payment gateway integration.
- **Automated Notifications**: Email/SMS alerts for upcoming payments and ownership milestones.
- **GPS Integration**: Real-time vehicle location tracking for active contracts.

---
*Built with integrity for the next generation of vehicle ownership.*
