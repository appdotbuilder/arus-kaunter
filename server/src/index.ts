import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createStoreInfoInputSchema,
  updateStoreInfoInputSchema,
  createProductCategoryInputSchema,
  updateProductCategoryInputSchema,
  createPaymentMethodInputSchema,
  updatePaymentMethodInputSchema,
  createAutomaticDiscountInputSchema,
  updateAutomaticDiscountInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  openCashRegisterInputSchema,
  closeCashRegisterInputSchema,
  createTransactionInputSchema,
  reportFilterSchema
} from './schema';

// Import handlers
import { createStoreInfo, getStoreInfo, updateStoreInfo } from './handlers/store_info';
import {
  createProductCategory,
  getProductCategories,
  updateProductCategory,
  deleteProductCategory
} from './handlers/product_categories';
import {
  createPaymentMethod,
  getPaymentMethods,
  getActivePaymentMethods,
  updatePaymentMethod,
  deletePaymentMethod
} from './handlers/payment_methods';
import {
  createAutomaticDiscount,
  getAutomaticDiscounts,
  getActiveAutomaticDiscounts,
  updateAutomaticDiscount,
  deleteAutomaticDiscount
} from './handlers/automatic_discounts';
import {
  createProduct,
  getProducts,
  getActiveProducts,
  getProductsByCategory,
  getProductById,
  updateProduct,
  deleteProduct
} from './handlers/products';
import {
  openCashRegister,
  getCurrentCashRegister,
  getTodayCashRegister,
  closeCashRegister,
  getCashRegisterHistory
} from './handlers/cash_register';
import {
  createTransaction,
  getTransactionById,
  getTransactionByReceiptId,
  getTodayTransactions,
  getTransactionsByDateRange
} from './handlers/transactions';
import { getDashboardStats } from './handlers/dashboard';
import {
  getDetailedSalesReport,
  getSalesByProductReport,
  getSalesByCategoryReport,
  getPaymentMethodReport,
  getDiscountReport
} from './handlers/reports';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Store Information routes
  storeInfo: router({
    create: publicProcedure
      .input(createStoreInfoInputSchema)
      .mutation(({ input }) => createStoreInfo(input)),
    get: publicProcedure
      .query(() => getStoreInfo()),
    update: publicProcedure
      .input(updateStoreInfoInputSchema)
      .mutation(({ input }) => updateStoreInfo(input))
  }),

  // Product Categories routes
  categories: router({
    create: publicProcedure
      .input(createProductCategoryInputSchema)
      .mutation(({ input }) => createProductCategory(input)),
    getAll: publicProcedure
      .query(() => getProductCategories()),
    update: publicProcedure
      .input(updateProductCategoryInputSchema)
      .mutation(({ input }) => updateProductCategory(input)),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteProductCategory(input.id))
  }),

  // Payment Methods routes
  paymentMethods: router({
    create: publicProcedure
      .input(createPaymentMethodInputSchema)
      .mutation(({ input }) => createPaymentMethod(input)),
    getAll: publicProcedure
      .query(() => getPaymentMethods()),
    getActive: publicProcedure
      .query(() => getActivePaymentMethods()),
    update: publicProcedure
      .input(updatePaymentMethodInputSchema)
      .mutation(({ input }) => updatePaymentMethod(input)),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deletePaymentMethod(input.id))
  }),

  // Automatic Discounts routes
  discounts: router({
    create: publicProcedure
      .input(createAutomaticDiscountInputSchema)
      .mutation(({ input }) => createAutomaticDiscount(input)),
    getAll: publicProcedure
      .query(() => getAutomaticDiscounts()),
    getActive: publicProcedure
      .query(() => getActiveAutomaticDiscounts()),
    update: publicProcedure
      .input(updateAutomaticDiscountInputSchema)
      .mutation(({ input }) => updateAutomaticDiscount(input)),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteAutomaticDiscount(input.id))
  }),

  // Products routes
  products: router({
    create: publicProcedure
      .input(createProductInputSchema)
      .mutation(({ input }) => createProduct(input)),
    getAll: publicProcedure
      .query(() => getProducts()),
    getActive: publicProcedure
      .query(() => getActiveProducts()),
    getByCategory: publicProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(({ input }) => getProductsByCategory(input.categoryId)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getProductById(input.id)),
    update: publicProcedure
      .input(updateProductInputSchema)
      .mutation(({ input }) => updateProduct(input)),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteProduct(input.id))
  }),

  // Cash Register routes
  cashRegister: router({
    open: publicProcedure
      .input(openCashRegisterInputSchema)
      .mutation(({ input }) => openCashRegister(input)),
    getCurrent: publicProcedure
      .query(() => getCurrentCashRegister()),
    getToday: publicProcedure
      .query(() => getTodayCashRegister()),
    close: publicProcedure
      .input(closeCashRegisterInputSchema)
      .mutation(({ input }) => closeCashRegister(input)),
    getHistory: publicProcedure
      .query(() => getCashRegisterHistory())
  }),

  // Transaction routes
  transactions: router({
    create: publicProcedure
      .input(createTransactionInputSchema)
      .mutation(({ input }) => createTransaction(input)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getTransactionById(input.id)),
    getByReceiptId: publicProcedure
      .input(z.object({ receiptId: z.string() }))
      .query(({ input }) => getTransactionByReceiptId(input.receiptId)),
    getToday: publicProcedure
      .query(() => getTodayTransactions()),
    getByDateRange: publicProcedure
      .input(z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date()
      }))
      .query(({ input }) => getTransactionsByDateRange(input.startDate, input.endDate))
  }),

  // Dashboard route
  dashboard: router({
    getStats: publicProcedure
      .query(() => getDashboardStats())
  }),

  // Reports routes
  reports: router({
    detailedSales: publicProcedure
      .input(reportFilterSchema)
      .query(({ input }) => getDetailedSalesReport(input)),
    salesByProduct: publicProcedure
      .input(reportFilterSchema)
      .query(({ input }) => getSalesByProductReport(input)),
    salesByCategory: publicProcedure
      .input(reportFilterSchema)
      .query(({ input }) => getSalesByCategoryReport(input)),
    paymentMethod: publicProcedure
      .input(reportFilterSchema)
      .query(({ input }) => getPaymentMethodReport(input)),
    discount: publicProcedure
      .input(reportFilterSchema)
      .query(({ input }) => getDiscountReport(input))
  })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`ARUS KAUNTER POS TRPC server listening at port: ${port}`);
}

start();