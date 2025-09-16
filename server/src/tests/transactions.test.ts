import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  transactionsTable, 
  transactionItemsTable, 
  productsTable, 
  productCategoriesTable,
  paymentMethodsTable,
  automaticDiscountsTable,
  cashRegistersTable
} from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { 
  createTransaction, 
  getTransactionById, 
  getTransactionByReceiptId,
  getTodayTransactions,
  getTransactionsByDateRange
} from '../handlers/transactions';
import { eq, desc } from 'drizzle-orm';

describe('Transaction Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const setupTestData = async () => {
    // Create category
    const categoryResult = await db.insert(productCategoriesTable)
      .values({ name: 'Electronics' })
      .returning()
      .execute();
    const categoryId = categoryResult[0].id;

    // Create products
    const product1Result = await db.insert(productsTable)
      .values({
        product_id: 'PROD001',
        name: 'Test Product 1',
        category_id: categoryId,
        original_price: '10.00',
        discount_percentage: '0',
        price_after_discount: '10.00',
        is_active: true
      })
      .returning()
      .execute();

    const product2Result = await db.insert(productsTable)
      .values({
        product_id: 'PROD002',
        name: 'Test Product 2',
        category_id: categoryId,
        original_price: '25.00',
        discount_percentage: '10',
        price_after_discount: '22.50',
        is_active: true
      })
      .returning()
      .execute();

    // Create payment methods
    const cashPaymentResult = await db.insert(paymentMethodsTable)
      .values({
        name: 'Cash',
        transaction_charge_percentage: '0',
        is_active: true
      })
      .returning()
      .execute();

    const cardPaymentResult = await db.insert(paymentMethodsTable)
      .values({
        name: 'Card',
        transaction_charge_percentage: '2.5',
        is_active: true
      })
      .returning()
      .execute();

    // Create automatic discount
    await db.insert(automaticDiscountsTable)
      .values({
        minimum_amount: '50.00',
        discount_percentage: '10',
        is_active: true
      })
      .execute();

    // Create cash register
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const cashRegisterResult = await db.insert(cashRegistersTable)
      .values({
        date: dateString,
        starting_capital: '100.00',
        cash_sales_total: '0',
        expected_cash: '100.00',
        is_closed: false
      })
      .returning()
      .execute();

    return {
      categoryId,
      product1Id: product1Result[0].id,
      product2Id: product2Result[0].id,
      cashPaymentId: cashPaymentResult[0].id,
      cardPaymentId: cardPaymentResult[0].id,
      cashRegisterId: cashRegisterResult[0].id
    };
  };

  describe('createTransaction', () => {
    it('should create a transaction with cash payment', async () => {
      const testData = await setupTestData();
      
      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 2 },
          { product_id: testData.product2Id, quantity: 1 }
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 50.00
      };

      const result = await createTransaction(input);

      // Verify transaction creation
      expect(result.transaction.id).toBeDefined();
      expect(result.receipt_id).toMatch(/^RCP\d+/);
      expect(result.transaction.subtotal).toBe(42.50); // 2*10 + 1*22.50
      expect(result.transaction.discount_amount).toBe(0); // No discount (below 50)
      expect(result.transaction.payment_charge).toBe(0); // Cash has no charge
      expect(result.transaction.final_total).toBe(42.50);
      expect(result.transaction.amount_received).toBe(50.00);
      expect(result.transaction.change_amount).toBe(7.50);
      expect(result.transaction.cash_register_id).toBe(testData.cashRegisterId);

      // Verify transaction items were created
      const items = await db.select()
        .from(transactionItemsTable)
        .where(eq(transactionItemsTable.transaction_id, result.transaction.id))
        .execute();

      expect(items).toHaveLength(2);
      expect(items[0].quantity).toBe(2);
      expect(parseFloat(items[0].unit_price)).toBe(10.00);
      expect(parseFloat(items[0].total_price)).toBe(20.00);

      // Verify cash register was updated
      const cashRegister = await db.select()
        .from(cashRegistersTable)
        .where(eq(cashRegistersTable.id, testData.cashRegisterId))
        .execute();

      expect(parseFloat(cashRegister[0].cash_sales_total)).toBe(42.50);
      expect(parseFloat(cashRegister[0].expected_cash)).toBe(142.50); // 100 + 42.50
    });

    it('should create a transaction with card payment and charges', async () => {
      const testData = await setupTestData();
      
      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 5 },
        ],
        payment_method_id: testData.cardPaymentId,
        amount_received: null
      };

      const result = await createTransaction(input);

      expect(result.transaction.subtotal).toBe(50.00); // 5*10
      expect(result.transaction.discount_amount).toBe(5.00); // 10% of 50
      expect(result.transaction.payment_charge).toBe(1.13); // 2.5% of (50-5) rounded
      expect(result.transaction.final_total).toBe(46.13); // 50 - 5 + 1.13
      expect(result.transaction.amount_received).toBeNull();
      expect(result.transaction.change_amount).toBeNull();

      // Verify cash register was NOT updated for card payment
      const cashRegister = await db.select()
        .from(cashRegistersTable)
        .where(eq(cashRegistersTable.id, testData.cashRegisterId))
        .execute();

      expect(parseFloat(cashRegister[0].cash_sales_total)).toBe(0);
    });

    it('should apply automatic discount when threshold is met', async () => {
      const testData = await setupTestData();
      
      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 6 }, // 60.00 total
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 60.00
      };

      const result = await createTransaction(input);

      expect(result.transaction.subtotal).toBe(60.00);
      expect(result.transaction.discount_amount).toBe(6.00); // 10% discount
      expect(result.transaction.final_total).toBe(54.00);
    });

    it('should fail when no cash register is open', async () => {
      const testData = await setupTestData();
      
      // Close the cash register
      await db.update(cashRegistersTable)
        .set({ is_closed: true })
        .where(eq(cashRegistersTable.id, testData.cashRegisterId))
        .execute();

      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 1 },
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 20.00
      };

      await expect(createTransaction(input)).rejects.toThrow(/no active cash register/i);
    });

    it('should fail when product is inactive', async () => {
      const testData = await setupTestData();
      
      // Deactivate product
      await db.update(productsTable)
        .set({ is_active: false })
        .where(eq(productsTable.id, testData.product1Id))
        .execute();

      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 1 },
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 20.00
      };

      await expect(createTransaction(input)).rejects.toThrow(/not found or inactive/i);
    });

    it('should fail when payment method is inactive', async () => {
      const testData = await setupTestData();
      
      // Deactivate payment method
      await db.update(paymentMethodsTable)
        .set({ is_active: false })
        .where(eq(paymentMethodsTable.id, testData.cashPaymentId))
        .execute();

      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 1 },
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 20.00
      };

      await expect(createTransaction(input)).rejects.toThrow(/payment method not found or inactive/i);
    });
  });

  describe('getTransactionById', () => {
    it('should retrieve transaction with items', async () => {
      const testData = await setupTestData();
      
      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 2 },
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 25.00
      };

      const created = await createTransaction(input);
      const retrieved = await getTransactionById(created.transaction.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.transaction.id);
      expect(retrieved!.receipt_id).toBe(created.receipt_id);
      expect(retrieved!.subtotal).toBe(20.00);
      expect(retrieved!.items).toHaveLength(1);
      expect(retrieved!.items[0].quantity).toBe(2);
      expect(retrieved!.items[0].unit_price).toBe(10.00);
      expect(retrieved!.items[0].total_price).toBe(20.00);
    });

    it('should return null for non-existent transaction', async () => {
      const result = await getTransactionById(999);
      expect(result).toBeNull();
    });
  });

  describe('getTransactionByReceiptId', () => {
    it('should retrieve transaction by receipt ID', async () => {
      const testData = await setupTestData();
      
      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 1 },
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 15.00
      };

      const created = await createTransaction(input);
      const retrieved = await getTransactionByReceiptId(created.receipt_id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.receipt_id).toBe(created.receipt_id);
      expect(retrieved!.id).toBe(created.transaction.id);
      expect(retrieved!.items).toHaveLength(1);
    });

    it('should return null for non-existent receipt ID', async () => {
      const result = await getTransactionByReceiptId('INVALID');
      expect(result).toBeNull();
    });
  });

  describe('getTodayTransactions', () => {
    it('should retrieve today\'s transactions', async () => {
      const testData = await setupTestData();
      
      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 1 },
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 15.00
      };

      await createTransaction(input);
      await createTransaction(input);

      const todayTransactions = await getTodayTransactions();

      expect(todayTransactions).toHaveLength(2);
      expect(todayTransactions[0].transaction_time.toDateString()).toBe(new Date().toDateString());
      expect(todayTransactions[1].transaction_time.toDateString()).toBe(new Date().toDateString());
      
      // Should be ordered by transaction_time descending (most recent first)
      expect(todayTransactions[0].transaction_time >= todayTransactions[1].transaction_time).toBe(true);
    });

    it('should return empty array when no transactions today', async () => {
      const todayTransactions = await getTodayTransactions();
      expect(todayTransactions).toHaveLength(0);
    });
  });

  describe('getTransactionsByDateRange', () => {
    it('should retrieve transactions within date range', async () => {
      const testData = await setupTestData();
      
      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 1 },
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 15.00
      };

      await createTransaction(input);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const transactions = await getTransactionsByDateRange(today, tomorrow);

      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions[0].transaction_time >= today).toBe(true);
      expect(transactions[0].transaction_time <= tomorrow).toBe(true);
    });

    it('should return empty array for date range with no transactions', async () => {
      const pastDate = new Date('2020-01-01');
      const anotherPastDate = new Date('2020-01-02');

      const transactions = await getTransactionsByDateRange(pastDate, anotherPastDate);
      expect(transactions).toHaveLength(0);
    });

    it('should handle date filtering correctly', async () => {
      const testData = await setupTestData();
      
      const input: CreateTransactionInput = {
        items: [
          { product_id: testData.product1Id, quantity: 1 },
        ],
        payment_method_id: testData.cashPaymentId,
        amount_received: 15.00
      };

      const created = await createTransaction(input);

      // Test exact date range including the transaction
      const startDate = new Date(created.transaction.transaction_time);
      startDate.setMinutes(startDate.getMinutes() - 1);
      
      const endDate = new Date(created.transaction.transaction_time);
      endDate.setMinutes(endDate.getMinutes() + 1);

      const transactions = await getTransactionsByDateRange(startDate, endDate);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].id).toBe(created.transaction.id);
    });
  });
});