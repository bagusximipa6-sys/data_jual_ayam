# Buku Keuangan Usaha (Business Finance Book)

A web-based application to track the finances of a small business, specifically for egg sales.

## Features

- **Dashboard:** A summary of key financial metrics like capital, sales, net profit, and receivables.
- **Sales Records:** Input daily sales data, including capital, quantity, and total sales, to automatically calculate profit.
- **Customer Accounts (Bakul):** Track bills, payments, and outstanding balances for each customer.
- **Operational Expenses:** Log various operational costs like fuel, parking, etc.
- **Reports:** View consolidated reports for sales, operations, and customer accounts.
- **Master Data:** See aggregated data for customers and expense categories.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **UI Components:** [@heroui/react](https://heroui.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Animation:** [Framer Motion](https://www.framer.com/motion/)
- **Icons:** [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- Node.js version 20 or higher.
- `npm` or another package manager.

### Running Locally

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:3000`.

## How It Works

The application uses the browser's `localStorage` to persist data, so no database is required. It operates in two modes:

- **User Mode:** A read-only view of all financial data.
- **Admin Mode:** Allows for adding, editing, and deleting records. This mode is protected by a password.