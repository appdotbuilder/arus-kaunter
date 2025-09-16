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
import { type ReportFilter } from '../schema';
import { getDetailedSalesReport } from '../handlers/reports';

describe('getDetailedSalesReport', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    // Helper function to create test data
    async function setupTestData() {
        // Create category
        const category = await db.insert(productCategoriesTable)
            .values({ name: 'Test Category' })
            .returning()
            .execute();

        // Create products
        const products = await db.insert(productsTable)
            .values([
                {
                    product_id: 'PROD001',
                    name: 'Test Product 1',
                    category_id: category[0].id,
                    original_price: '25.00',
                    discount_percentage: '0',
                    price_after_discount: '25.00'
                },
                {
                    product_id: 'PROD002', 
                    name: 'Test Product 2',
                    category_id: category[0].id,
                    original_price: '15.50',
                    discount_percentage: '10',
                    price_after_discount: '13.95'
                }
            ])
            .returning()
            .execute();

        // Create payment method
        const paymentMethod = await db.insert(paymentMethodsTable)
            .values({
                name: 'Cash',
                transaction_charge_percentage: '0'
            })
            .returning()
            .execute();

        // Create cash register
        const cashRegister = await db.insert(cashRegistersTable)
            .values({
                date: '2024-01-15',
                starting_capital: '100.00'
            })
            .returning()
            .execute();

        return { products, paymentMethod, cashRegister };
    }

    it('should return empty report when no transactions exist', async () => {
        await setupTestData();

        const filter: ReportFilter = {};
        const result = await getDetailedSalesReport(filter);

        expect(result.transactions).toHaveLength(0);
        expect(result.summary.total_sales).toBe(0);
        expect(result.summary.total_transactions).toBe(0);
        expect(result.summary.total_discount).toBe(0);
        expect(result.summary.total_charges).toBe(0);
    });

    it('should generate detailed sales report with transactions', async () => {
        const { products, paymentMethod, cashRegister } = await setupTestData();

        // Create transactions
        const transaction1 = await db.insert(transactionsTable)
            .values({
                receipt_id: 'REC001',
                cash_register_id: cashRegister[0].id,
                subtotal: '40.50',
                discount_amount: '2.50',
                payment_charge: '0.00',
                final_total: '38.00',
                payment_method_id: paymentMethod[0].id,
                transaction_time: new Date('2024-01-15T10:30:00')
            })
            .returning()
            .execute();

        const transaction2 = await db.insert(transactionsTable)
            .values({
                receipt_id: 'REC002',
                cash_register_id: cashRegister[0].id,
                subtotal: '25.00',
                discount_amount: '0.00',
                payment_charge: '1.25',
                final_total: '26.25',
                payment_method_id: paymentMethod[0].id,
                transaction_time: new Date('2024-01-15T14:15:00')
            })
            .returning()
            .execute();

        // Create transaction items
        await db.insert(transactionItemsTable)
            .values([
                {
                    transaction_id: transaction1[0].id,
                    product_id: products[0].id,
                    quantity: 1,
                    unit_price: '25.00',
                    total_price: '25.00'
                },
                {
                    transaction_id: transaction1[0].id,
                    product_id: products[1].id,
                    quantity: 1,
                    unit_price: '15.50',
                    total_price: '15.50'
                },
                {
                    transaction_id: transaction2[0].id,
                    product_id: products[0].id,
                    quantity: 1,
                    unit_price: '25.00',
                    total_price: '25.00'
                }
            ])
            .execute();

        const filter: ReportFilter = {};
        const result = await getDetailedSalesReport(filter);

        // Verify report structure
        expect(result.transactions).toHaveLength(2);
        expect(result.summary.total_sales).toBe(64.25);
        expect(result.summary.total_transactions).toBe(2);
        expect(result.summary.total_discount).toBe(2.5);
        expect(result.summary.total_charges).toBe(1.25);

        // Verify first transaction details
        const firstTransaction = result.transactions.find(t => t.receipt_id === 'REC001');
        expect(firstTransaction).toBeDefined();
        expect(firstTransaction!.items).toHaveLength(2);
        expect(firstTransaction!.subtotal).toBe(40.5);
        expect(firstTransaction!.discount_amount).toBe(2.5);
        expect(firstTransaction!.payment_charge).toBe(0);
        expect(firstTransaction!.final_total).toBe(38);
        expect(firstTransaction!.payment_method).toBe('Cash');
        expect(firstTransaction!.transaction_time).toBeInstanceOf(Date);

        // Verify transaction items
        const firstItem = firstTransaction!.items.find(item => item.product_name === 'Test Product 1');
        expect(firstItem).toBeDefined();
        expect(firstItem!.quantity).toBe(1);
        expect(firstItem!.unit_price).toBe(25);
        expect(firstItem!.total_price).toBe(25);

        // Verify numeric types
        expect(typeof result.summary.total_sales).toBe('number');
        expect(typeof firstTransaction!.subtotal).toBe('number');
        expect(typeof firstItem!.unit_price).toBe('number');
    });

    it('should filter transactions by start date', async () => {
        const { products, paymentMethod, cashRegister } = await setupTestData();

        // Create transactions on different dates
        const transaction1 = await db.insert(transactionsTable)
            .values({
                receipt_id: 'REC001',
                cash_register_id: cashRegister[0].id,
                subtotal: '25.00',
                discount_amount: '0.00',
                payment_charge: '0.00',
                final_total: '25.00',
                payment_method_id: paymentMethod[0].id,
                transaction_time: new Date('2024-01-10T10:00:00')
            })
            .returning()
            .execute();

        const transaction2 = await db.insert(transactionsTable)
            .values({
                receipt_id: 'REC002',
                cash_register_id: cashRegister[0].id,
                subtotal: '30.00',
                discount_amount: '0.00',
                payment_charge: '0.00',
                final_total: '30.00',
                payment_method_id: paymentMethod[0].id,
                transaction_time: new Date('2024-01-20T10:00:00')
            })
            .returning()
            .execute();

        // Add items for both transactions
        await db.insert(transactionItemsTable)
            .values([
                {
                    transaction_id: transaction1[0].id,
                    product_id: products[0].id,
                    quantity: 1,
                    unit_price: '25.00',
                    total_price: '25.00'
                },
                {
                    transaction_id: transaction2[0].id,
                    product_id: products[0].id,
                    quantity: 1,
                    unit_price: '30.00',
                    total_price: '30.00'
                }
            ])
            .execute();

        // Filter by start date
        const filter: ReportFilter = {
            start_date: new Date('2024-01-15')
        };

        const result = await getDetailedSalesReport(filter);

        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].receipt_id).toBe('REC002');
        expect(result.summary.total_sales).toBe(30);
        expect(result.summary.total_transactions).toBe(1);
    });

    it('should filter transactions by end date', async () => {
        const { products, paymentMethod, cashRegister } = await setupTestData();

        // Create transactions on different dates
        const transaction1 = await db.insert(transactionsTable)
            .values({
                receipt_id: 'REC001',
                cash_register_id: cashRegister[0].id,
                subtotal: '25.00',
                discount_amount: '0.00',
                payment_charge: '0.00',
                final_total: '25.00',
                payment_method_id: paymentMethod[0].id,
                transaction_time: new Date('2024-01-10T10:00:00')
            })
            .returning()
            .execute();

        const transaction2 = await db.insert(transactionsTable)
            .values({
                receipt_id: 'REC002',
                cash_register_id: cashRegister[0].id,
                subtotal: '30.00',
                discount_amount: '0.00',
                payment_charge: '0.00',
                final_total: '30.00',
                payment_method_id: paymentMethod[0].id,
                transaction_time: new Date('2024-01-20T10:00:00')
            })
            .returning()
            .execute();

        // Add items for both transactions
        await db.insert(transactionItemsTable)
            .values([
                {
                    transaction_id: transaction1[0].id,
                    product_id: products[0].id,
                    quantity: 1,
                    unit_price: '25.00',
                    total_price: '25.00'
                },
                {
                    transaction_id: transaction2[0].id,
                    product_id: products[0].id,
                    quantity: 1,
                    unit_price: '30.00',
                    total_price: '30.00'
                }
            ])
            .execute();

        // Filter by end date
        const filter: ReportFilter = {
            end_date: new Date('2024-01-15')
        };

        const result = await getDetailedSalesReport(filter);

        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].receipt_id).toBe('REC001');
        expect(result.summary.total_sales).toBe(25);
    });

    it('should filter transactions by date range', async () => {
        const { products, paymentMethod, cashRegister } = await setupTestData();

        // Create transactions on different dates
        await db.insert(transactionsTable)
            .values([
                {
                    receipt_id: 'REC001',
                    cash_register_id: cashRegister[0].id,
                    subtotal: '25.00',
                    discount_amount: '0.00',
                    payment_charge: '0.00',
                    final_total: '25.00',
                    payment_method_id: paymentMethod[0].id,
                    transaction_time: new Date('2024-01-05T10:00:00')
                },
                {
                    receipt_id: 'REC002',
                    cash_register_id: cashRegister[0].id,
                    subtotal: '30.00',
                    discount_amount: '0.00',
                    payment_charge: '0.00',
                    final_total: '30.00',
                    payment_method_id: paymentMethod[0].id,
                    transaction_time: new Date('2024-01-15T10:00:00')
                },
                {
                    receipt_id: 'REC003',
                    cash_register_id: cashRegister[0].id,
                    subtotal: '35.00',
                    discount_amount: '0.00',
                    payment_charge: '0.00',
                    final_total: '35.00',
                    payment_method_id: paymentMethod[0].id,
                    transaction_time: new Date('2024-01-25T10:00:00')
                }
            ])
            .returning()
            .execute();

        // Filter by date range (should only include middle transaction)
        const filter: ReportFilter = {
            start_date: new Date('2024-01-10'),
            end_date: new Date('2024-01-20')
        };

        const result = await getDetailedSalesReport(filter);

        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].receipt_id).toBe('REC002');
        expect(result.summary.total_sales).toBe(30);
    });

    it('should handle transactions without items gracefully', async () => {
        const { paymentMethod, cashRegister } = await setupTestData();

        // Create transaction without items
        await db.insert(transactionsTable)
            .values({
                receipt_id: 'REC001',
                cash_register_id: cashRegister[0].id,
                subtotal: '0.00',
                discount_amount: '0.00',
                payment_charge: '0.00',
                final_total: '0.00',
                payment_method_id: paymentMethod[0].id,
                transaction_time: new Date('2024-01-15T10:00:00')
            })
            .execute();

        const filter: ReportFilter = {};
        const result = await getDetailedSalesReport(filter);

        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].items).toHaveLength(0);
        expect(result.transactions[0].receipt_id).toBe('REC001');
        expect(result.summary.total_sales).toBe(0);
    });
});