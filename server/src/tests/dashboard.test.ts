import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  productCategoriesTable, 
  productsTable, 
  paymentMethodsTable, 
  cashRegistersTable,
  transactionsTable,
  transactionItemsTable
} from '../db/schema';
import { getDashboardStats } from '../handlers/dashboard';

describe('getDashboardStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty dashboard stats when no data exists', async () => {
    const result = await getDashboardStats();

    expect(result.todays_sales).toEqual(0);
    expect(result.todays_transactions).toEqual(0);
    expect(result.top_products).toHaveLength(0);
    expect(result.weekly_sales).toHaveLength(7);
    expect(result.cash_register_status.is_open).toBe(false);
    expect(result.cash_register_status.current_register_id).toBeNull();

    // Verify weekly sales are all zeros
    result.weekly_sales.forEach(day => {
      expect(day.total_sales).toEqual(0);
      expect(day.date).toBeInstanceOf(Date);
    });
  });

  it('should calculate todays sales and transaction count correctly', async () => {
    // Create test data
    const category = await db.insert(productCategoriesTable)
      .values({ name: 'Food' })
      .returning()
      .execute();

    const product = await db.insert(productsTable)
      .values({
        product_id: 'PROD001',
        name: 'Nasi Lemak',
        category_id: category[0].id,
        original_price: '15.00',
        discount_percentage: '0',
        price_after_discount: '15.00'
      })
      .returning()
      .execute();

    const paymentMethod = await db.insert(paymentMethodsTable)
      .values({
        name: 'Cash',
        transaction_charge_percentage: '0'
      })
      .returning()
      .execute();

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const cashRegister = await db.insert(cashRegistersTable)
      .values({
        date: dateStr,
        starting_capital: '500.00'
      })
      .returning()
      .execute();

    // Create today's transactions
    const transaction1 = await db.insert(transactionsTable)
      .values({
        receipt_id: 'RCP001',
        cash_register_id: cashRegister[0].id,
        subtotal: '30.00',
        discount_amount: '0',
        payment_charge: '0',
        final_total: '30.00',
        payment_method_id: paymentMethod[0].id,
        transaction_time: new Date()
      })
      .returning()
      .execute();

    const transaction2 = await db.insert(transactionsTable)
      .values({
        receipt_id: 'RCP002',
        cash_register_id: cashRegister[0].id,
        subtotal: '45.00',
        discount_amount: '5.00',
        payment_charge: '0',
        final_total: '40.00',
        payment_method_id: paymentMethod[0].id,
        transaction_time: new Date()
      })
      .returning()
      .execute();

    const result = await getDashboardStats();

    expect(result.todays_sales).toEqual(70);
    expect(result.todays_transactions).toEqual(2);
  });

  it('should calculate top products correctly', async () => {
    // Create test data
    const category = await db.insert(productCategoriesTable)
      .values({ name: 'Food' })
      .returning()
      .execute();

    const product1 = await db.insert(productsTable)
      .values({
        product_id: 'PROD001',
        name: 'Nasi Lemak',
        category_id: category[0].id,
        original_price: '15.00',
        discount_percentage: '0',
        price_after_discount: '15.00'
      })
      .returning()
      .execute();

    const product2 = await db.insert(productsTable)
      .values({
        product_id: 'PROD002',
        name: 'Teh Tarik',
        category_id: category[0].id,
        original_price: '3.00',
        discount_percentage: '0',
        price_after_discount: '3.00'
      })
      .returning()
      .execute();

    const paymentMethod = await db.insert(paymentMethodsTable)
      .values({
        name: 'Cash',
        transaction_charge_percentage: '0'
      })
      .returning()
      .execute();

    const cashRegister = await db.insert(cashRegistersTable)
      .values({
        date: new Date().toISOString().split('T')[0],
        starting_capital: '500.00'
      })
      .returning()
      .execute();

    const transaction = await db.insert(transactionsTable)
      .values({
        receipt_id: 'RCP001',
        cash_register_id: cashRegister[0].id,
        subtotal: '39.00',
        discount_amount: '0',
        payment_charge: '0',
        final_total: '39.00',
        payment_method_id: paymentMethod[0].id,
        transaction_time: new Date()
      })
      .returning()
      .execute();

    // Create transaction items
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction[0].id,
        product_id: product1[0].id,
        quantity: 2,
        unit_price: '15.00',
        total_price: '30.00'
      })
      .execute();

    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction[0].id,
        product_id: product2[0].id,
        quantity: 3,
        unit_price: '3.00',
        total_price: '9.00'
      })
      .execute();

    const result = await getDashboardStats();

    expect(result.top_products).toHaveLength(2);
    
    // Teh Tarik should be first (higher quantity: 3)
    expect(result.top_products[0].product_name).toEqual('Teh Tarik');
    expect(result.top_products[0].total_quantity).toEqual(3);
    expect(result.top_products[0].total_sales).toEqual(9);
    
    // Nasi Lemak should be second (lower quantity: 2)
    expect(result.top_products[1].product_name).toEqual('Nasi Lemak');
    expect(result.top_products[1].total_quantity).toEqual(2);
    expect(result.top_products[1].total_sales).toEqual(30);
  });

  it('should calculate weekly sales correctly', async () => {
    // Create test data
    const category = await db.insert(productCategoriesTable)
      .values({ name: 'Food' })
      .returning()
      .execute();

    const product = await db.insert(productsTable)
      .values({
        product_id: 'PROD001',
        name: 'Test Product',
        category_id: category[0].id,
        original_price: '10.00',
        discount_percentage: '0',
        price_after_discount: '10.00'
      })
      .returning()
      .execute();

    const paymentMethod = await db.insert(paymentMethodsTable)
      .values({
        name: 'Cash',
        transaction_charge_percentage: '0'
      })
      .returning()
      .execute();

    const cashRegister = await db.insert(cashRegistersTable)
      .values({
        date: new Date().toISOString().split('T')[0],
        starting_capital: '500.00'
      })
      .returning()
      .execute();

    // Create transaction 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(12, 0, 0, 0);

    await db.insert(transactionsTable)
      .values({
        receipt_id: 'RCP001',
        cash_register_id: cashRegister[0].id,
        subtotal: '100.00',
        discount_amount: '0',
        payment_charge: '0',
        final_total: '100.00',
        payment_method_id: paymentMethod[0].id,
        transaction_time: threeDaysAgo
      })
      .execute();

    // Create transaction today
    const today = new Date();
    await db.insert(transactionsTable)
      .values({
        receipt_id: 'RCP002',
        cash_register_id: cashRegister[0].id,
        subtotal: '50.00',
        discount_amount: '0',
        payment_charge: '0',
        final_total: '50.00',
        payment_method_id: paymentMethod[0].id,
        transaction_time: today
      })
      .execute();

    const result = await getDashboardStats();

    expect(result.weekly_sales).toHaveLength(7);
    
    // Find today's sales (should be last day in the array)
    const todaysSales = result.weekly_sales[6];
    expect(todaysSales.total_sales).toEqual(50);

    // Find 3 days ago sales
    const threeDaysAgoSales = result.weekly_sales[3];
    expect(threeDaysAgoSales.total_sales).toEqual(100);

    // Other days should have zero sales
    const otherDays = result.weekly_sales.filter((_, index) => index !== 3 && index !== 6);
    otherDays.forEach(day => {
      expect(day.total_sales).toEqual(0);
    });
  });

  it('should determine cash register status correctly', async () => {
    // Test with open cash register
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const openRegister = await db.insert(cashRegistersTable)
      .values({
        date: dateStr,
        starting_capital: '500.00',
        is_closed: false
      })
      .returning()
      .execute();

    let result = await getDashboardStats();

    expect(result.cash_register_status.is_open).toBe(true);
    expect(result.cash_register_status.current_register_id).toEqual(openRegister[0].id);

    // Test with closed cash register
    await db.insert(cashRegistersTable)
      .values({
        date: dateStr,
        starting_capital: '600.00',
        is_closed: true,
        closed_at: new Date()
      })
      .execute();

    result = await getDashboardStats();

    expect(result.cash_register_status.is_open).toBe(false);
    expect(result.cash_register_status.current_register_id).toBeDefined();
  });

  it('should handle date boundaries correctly for todays sales', async () => {
    // Create test data
    const category = await db.insert(productCategoriesTable)
      .values({ name: 'Food' })
      .returning()
      .execute();

    const product = await db.insert(productsTable)
      .values({
        product_id: 'PROD001',
        name: 'Test Product',
        category_id: category[0].id,
        original_price: '10.00',
        discount_percentage: '0',
        price_after_discount: '10.00'
      })
      .returning()
      .execute();

    const paymentMethod = await db.insert(paymentMethodsTable)
      .values({
        name: 'Cash',
        transaction_charge_percentage: '0'
      })
      .returning()
      .execute();

    const cashRegister = await db.insert(cashRegistersTable)
      .values({
        date: new Date().toISOString().split('T')[0],
        starting_capital: '500.00'
      })
      .returning()
      .execute();

    // Create transaction from yesterday (should not be included)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    await db.insert(transactionsTable)
      .values({
        receipt_id: 'RCP001',
        cash_register_id: cashRegister[0].id,
        subtotal: '100.00',
        discount_amount: '0',
        payment_charge: '0',
        final_total: '100.00',
        payment_method_id: paymentMethod[0].id,
        transaction_time: yesterday
      })
      .execute();

    // Create transaction at beginning of today (should be included)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 1);

    await db.insert(transactionsTable)
      .values({
        receipt_id: 'RCP002',
        cash_register_id: cashRegister[0].id,
        subtotal: '50.00',
        discount_amount: '0',
        payment_charge: '0',
        final_total: '50.00',
        payment_method_id: paymentMethod[0].id,
        transaction_time: todayStart
      })
      .execute();

    const result = await getDashboardStats();

    // Only today's transaction should be counted
    expect(result.todays_sales).toEqual(50);
    expect(result.todays_transactions).toEqual(1);
  });
});