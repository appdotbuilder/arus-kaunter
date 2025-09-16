import { z } from 'zod';

// Store Information Schema
export const storeInfoSchema = z.object({
  id: z.number(),
  store_name: z.string(),
  ssm_no: z.string().nullable(),
  address: z.string().nullable(),
  phone_no: z.string().nullable(),
  logo_url: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type StoreInfo = z.infer<typeof storeInfoSchema>;

export const createStoreInfoInputSchema = z.object({
  store_name: z.string().min(1, "Store name is required"),
  ssm_no: z.string().nullable(),
  address: z.string().nullable(),
  phone_no: z.string().nullable(),
  logo_url: z.string().nullable()
});

export type CreateStoreInfoInput = z.infer<typeof createStoreInfoInputSchema>;

export const updateStoreInfoInputSchema = z.object({
  id: z.number(),
  store_name: z.string().min(1).optional(),
  ssm_no: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone_no: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional()
});

export type UpdateStoreInfoInput = z.infer<typeof updateStoreInfoInputSchema>;

// Product Category Schema
export const productCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ProductCategory = z.infer<typeof productCategorySchema>;

export const createProductCategoryInputSchema = z.object({
  name: z.string().min(1, "Category name is required")
});

export type CreateProductCategoryInput = z.infer<typeof createProductCategoryInputSchema>;

export const updateProductCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional()
});

export type UpdateProductCategoryInput = z.infer<typeof updateProductCategoryInputSchema>;

// Payment Method Schema
export const paymentMethodSchema = z.object({
  id: z.number(),
  name: z.string(),
  transaction_charge_percentage: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const createPaymentMethodInputSchema = z.object({
  name: z.string().min(1, "Payment method name is required"),
  transaction_charge_percentage: z.number().min(0).max(100),
  is_active: z.boolean().default(true)
});

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodInputSchema>;

export const updatePaymentMethodInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  transaction_charge_percentage: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional()
});

export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodInputSchema>;

// Automatic Discount Schema
export const automaticDiscountSchema = z.object({
  id: z.number(),
  minimum_amount: z.number(),
  discount_percentage: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type AutomaticDiscount = z.infer<typeof automaticDiscountSchema>;

export const createAutomaticDiscountInputSchema = z.object({
  minimum_amount: z.number().positive("Minimum amount must be positive"),
  discount_percentage: z.number().min(0).max(100),
  is_active: z.boolean().default(true)
});

export type CreateAutomaticDiscountInput = z.infer<typeof createAutomaticDiscountInputSchema>;

export const updateAutomaticDiscountInputSchema = z.object({
  id: z.number(),
  minimum_amount: z.number().positive().optional(),
  discount_percentage: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional()
});

export type UpdateAutomaticDiscountInput = z.infer<typeof updateAutomaticDiscountInputSchema>;

// Product Schema
export const productSchema = z.object({
  id: z.number(),
  product_id: z.string(),
  name: z.string(),
  category_id: z.number(),
  original_price: z.number(),
  discount_percentage: z.number(),
  price_after_discount: z.number(),
  image_url: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

export const createProductInputSchema = z.object({
  product_id: z.string().optional(), // Auto-generated if not provided
  name: z.string().min(1, "Product name is required"),
  category_id: z.number().positive(),
  original_price: z.number().positive("Price must be positive"),
  discount_percentage: z.number().min(0).max(100).default(0),
  image_url: z.string().nullable().optional()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  product_id: z.string().optional(),
  name: z.string().min(1).optional(),
  category_id: z.number().positive().optional(),
  original_price: z.number().positive().optional(),
  discount_percentage: z.number().min(0).max(100).optional(),
  image_url: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Cash Register Schema
export const cashRegisterSchema = z.object({
  id: z.number(),
  date: z.coerce.date(),
  starting_capital: z.number(),
  cash_sales_total: z.number(),
  expected_cash: z.number(),
  actual_cash_counted: z.number().nullable(),
  surplus_shortage: z.number().nullable(),
  is_closed: z.boolean(),
  opened_at: z.coerce.date(),
  closed_at: z.coerce.date().nullable()
});

export type CashRegister = z.infer<typeof cashRegisterSchema>;

export const openCashRegisterInputSchema = z.object({
  starting_capital: z.number().nonnegative("Starting capital must be non-negative")
});

export type OpenCashRegisterInput = z.infer<typeof openCashRegisterInputSchema>;

export const closeCashRegisterInputSchema = z.object({
  id: z.number(),
  actual_cash_counted: z.number().nonnegative()
});

export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterInputSchema>;

// Transaction Schema
export const transactionSchema = z.object({
  id: z.number(),
  receipt_id: z.string(),
  cash_register_id: z.number(),
  subtotal: z.number(),
  discount_amount: z.number(),
  payment_charge: z.number(),
  final_total: z.number(),
  payment_method_id: z.number(),
  amount_received: z.number().nullable(), // For cash payments
  change_amount: z.number().nullable(), // For cash payments
  transaction_time: z.coerce.date(),
  created_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Transaction Item Schema
export const transactionItemSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  product_id: z.number(),
  quantity: z.number(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;

// Cart Item Schema (for POS interface)
export const cartItemSchema = z.object({
  product_id: z.number(),
  quantity: z.number().int().positive()
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Create Transaction Input Schema
export const createTransactionInputSchema = z.object({
  items: z.array(cartItemSchema).min(1, "At least one item is required"),
  payment_method_id: z.number().positive(),
  amount_received: z.number().nullable() // Required for cash payments
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Report Filter Schema
export const reportFilterSchema = z.object({
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  category_id: z.number().optional(),
  payment_method_id: z.number().optional()
});

export type ReportFilter = z.infer<typeof reportFilterSchema>;

// Dashboard Stats Schema
export const dashboardStatsSchema = z.object({
  todays_sales: z.number(),
  todays_transactions: z.number(),
  top_products: z.array(z.object({
    product_id: z.number(),
    product_name: z.string(),
    total_quantity: z.number(),
    total_sales: z.number()
  })),
  weekly_sales: z.array(z.object({
    date: z.coerce.date(),
    total_sales: z.number()
  })),
  cash_register_status: z.object({
    is_open: z.boolean(),
    current_register_id: z.number().nullable()
  })
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

// Sales Report Schema
export const salesReportSchema = z.object({
  transactions: z.array(z.object({
    receipt_id: z.string(),
    transaction_time: z.coerce.date(),
    items: z.array(z.object({
      product_name: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      total_price: z.number()
    })),
    subtotal: z.number(),
    discount_amount: z.number(),
    payment_charge: z.number(),
    final_total: z.number(),
    payment_method: z.string()
  })),
  summary: z.object({
    total_sales: z.number(),
    total_transactions: z.number(),
    total_discount: z.number(),
    total_charges: z.number()
  })
});

export type SalesReport = z.infer<typeof salesReportSchema>;