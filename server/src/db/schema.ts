import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  date,
  varchar
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Store Information Table
export const storeInfoTable = pgTable('store_info', {
  id: serial('id').primaryKey(),
  store_name: text('store_name').notNull(),
  ssm_no: text('ssm_no'),
  address: text('address'),
  phone_no: text('phone_no'),
  logo_url: text('logo_url'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Product Categories Table
export const productCategoriesTable = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Payment Methods Table
export const paymentMethodsTable = pgTable('payment_methods', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  transaction_charge_percentage: numeric('transaction_charge_percentage', { precision: 5, scale: 2 }).notNull().default('0'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Automatic Discounts Table
export const automaticDiscountsTable = pgTable('automatic_discounts', {
  id: serial('id').primaryKey(),
  minimum_amount: numeric('minimum_amount', { precision: 10, scale: 2 }).notNull(),
  discount_percentage: numeric('discount_percentage', { precision: 5, scale: 2 }).notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Products Table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  product_id: varchar('product_id', { length: 50 }).notNull().unique(),
  name: text('name').notNull(),
  category_id: integer('category_id').notNull(),
  original_price: numeric('original_price', { precision: 10, scale: 2 }).notNull(),
  discount_percentage: numeric('discount_percentage', { precision: 5, scale: 2 }).notNull().default('0'),
  price_after_discount: numeric('price_after_discount', { precision: 10, scale: 2 }).notNull(),
  image_url: text('image_url'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Cash Register Table
export const cashRegistersTable = pgTable('cash_registers', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  starting_capital: numeric('starting_capital', { precision: 10, scale: 2 }).notNull(),
  cash_sales_total: numeric('cash_sales_total', { precision: 10, scale: 2 }).notNull().default('0'),
  expected_cash: numeric('expected_cash', { precision: 10, scale: 2 }).notNull().default('0'),
  actual_cash_counted: numeric('actual_cash_counted', { precision: 10, scale: 2 }),
  surplus_shortage: numeric('surplus_shortage', { precision: 10, scale: 2 }),
  is_closed: boolean('is_closed').notNull().default(false),
  opened_at: timestamp('opened_at').defaultNow().notNull(),
  closed_at: timestamp('closed_at')
});

// Transactions Table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  receipt_id: varchar('receipt_id', { length: 50 }).notNull().unique(),
  cash_register_id: integer('cash_register_id').notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  discount_amount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  payment_charge: numeric('payment_charge', { precision: 10, scale: 2 }).notNull().default('0'),
  final_total: numeric('final_total', { precision: 10, scale: 2 }).notNull(),
  payment_method_id: integer('payment_method_id').notNull(),
  amount_received: numeric('amount_received', { precision: 10, scale: 2 }),
  change_amount: numeric('change_amount', { precision: 10, scale: 2 }),
  transaction_time: timestamp('transaction_time').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Transaction Items Table
export const transactionItemsTable = pgTable('transaction_items', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const productCategoriesRelations = relations(productCategoriesTable, ({ many }) => ({
  products: many(productsTable)
}));

export const productsRelations = relations(productsTable, ({ one, many }) => ({
  category: one(productCategoriesTable, {
    fields: [productsTable.category_id],
    references: [productCategoriesTable.id]
  }),
  transactionItems: many(transactionItemsTable)
}));

export const paymentMethodsRelations = relations(paymentMethodsTable, ({ many }) => ({
  transactions: many(transactionsTable)
}));

export const cashRegistersRelations = relations(cashRegistersTable, ({ many }) => ({
  transactions: many(transactionsTable)
}));

export const transactionsRelations = relations(transactionsTable, ({ one, many }) => ({
  cashRegister: one(cashRegistersTable, {
    fields: [transactionsTable.cash_register_id],
    references: [cashRegistersTable.id]
  }),
  paymentMethod: one(paymentMethodsTable, {
    fields: [transactionsTable.payment_method_id],
    references: [paymentMethodsTable.id]
  }),
  items: many(transactionItemsTable)
}));

export const transactionItemsRelations = relations(transactionItemsTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [transactionItemsTable.transaction_id],
    references: [transactionsTable.id]
  }),
  product: one(productsTable, {
    fields: [transactionItemsTable.product_id],
    references: [productsTable.id]
  })
}));

// TypeScript types for the table schemas
export type StoreInfo = typeof storeInfoTable.$inferSelect;
export type NewStoreInfo = typeof storeInfoTable.$inferInsert;

export type ProductCategory = typeof productCategoriesTable.$inferSelect;
export type NewProductCategory = typeof productCategoriesTable.$inferInsert;

export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
export type NewPaymentMethod = typeof paymentMethodsTable.$inferInsert;

export type AutomaticDiscount = typeof automaticDiscountsTable.$inferSelect;
export type NewAutomaticDiscount = typeof automaticDiscountsTable.$inferInsert;

export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;

export type CashRegister = typeof cashRegistersTable.$inferSelect;
export type NewCashRegister = typeof cashRegistersTable.$inferInsert;

export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;

export type TransactionItem = typeof transactionItemsTable.$inferSelect;
export type NewTransactionItem = typeof transactionItemsTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  storeInfo: storeInfoTable,
  productCategories: productCategoriesTable,
  paymentMethods: paymentMethodsTable,
  automaticDiscounts: automaticDiscountsTable,
  products: productsTable,
  cashRegisters: cashRegistersTable,
  transactions: transactionsTable,
  transactionItems: transactionItemsTable
};