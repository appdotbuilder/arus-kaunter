import { db } from '../db';
import { 
  transactionsTable, 
  transactionItemsTable, 
  productsTable, 
  paymentMethodsTable,
  automaticDiscountsTable,
  cashRegistersTable
} from '../db/schema';
import { type CreateTransactionInput, type Transaction, type TransactionItem } from '../schema';
import { eq, and, gte, lte, desc, isNull, sql } from 'drizzle-orm';

export async function createTransaction(input: CreateTransactionInput): Promise<{ transaction: Transaction; receipt_id: string }> {
  try {
    // Generate unique receipt ID
    const receiptId = `RCP${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 1. Get active cash register
    const activeCashRegister = await db.select()
      .from(cashRegistersTable)
      .where(eq(cashRegistersTable.is_closed, false))
      .limit(1)
      .execute();

    if (activeCashRegister.length === 0) {
      throw new Error('No active cash register found. Please open a cash register first.');
    }

    // 2. Validate all products exist and are active
    const productIds = input.items.map(item => item.product_id);
    const products = [];
    
    for (const productId of productIds) {
      const product = await db.select()
        .from(productsTable)
        .where(and(
          eq(productsTable.id, productId),
          eq(productsTable.is_active, true)
        ))
        .limit(1)
        .execute();
      
      if (product.length > 0) {
        products.push(product[0]);
      }
    }

    if (products.length !== productIds.length) {
      throw new Error('Some products are not found or inactive');
    }

    // Create product lookup map
    const productMap = new Map(products.map(p => [p.id, p]));

    // 3. Calculate subtotal
    let subtotal = 0;
    const itemDetails = input.items.map(item => {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new Error(`Product with ID ${item.product_id} not found`);
      }
      
      const unitPrice = parseFloat(product.price_after_discount);
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;
      
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      };
    });

    // 4. Check for automatic discounts
    const activeDiscounts = await db.select()
      .from(automaticDiscountsTable)
      .where(and(
        eq(automaticDiscountsTable.is_active, true),
        lte(automaticDiscountsTable.minimum_amount, subtotal.toString())
      ))
      .orderBy(desc(automaticDiscountsTable.discount_percentage))
      .limit(1)
      .execute();

    let discountAmount = 0;
    if (activeDiscounts.length > 0) {
      const discountPercentage = parseFloat(activeDiscounts[0].discount_percentage);
      discountAmount = (subtotal * discountPercentage) / 100;
    }

    // 5. Get payment method and calculate charges
    const paymentMethod = await db.select()
      .from(paymentMethodsTable)
      .where(and(
        eq(paymentMethodsTable.id, input.payment_method_id),
        eq(paymentMethodsTable.is_active, true)
      ))
      .limit(1)
      .execute();

    if (paymentMethod.length === 0) {
      throw new Error('Payment method not found or inactive');
    }

    const chargePercentage = parseFloat(paymentMethod[0].transaction_charge_percentage);
    const paymentCharge = Math.round(((subtotal - discountAmount) * chargePercentage) / 100 * 100) / 100;
    const finalTotal = subtotal - discountAmount + paymentCharge;

    // Calculate change for cash payments
    let changeAmount = null;
    if (input.amount_received !== null) {
      changeAmount = Math.max(0, input.amount_received - finalTotal);
    }

    // 6. Create transaction and items in a transaction
    const result = await db.transaction(async (tx) => {
      // Insert transaction
      const transactionResult = await tx.insert(transactionsTable)
        .values({
          receipt_id: receiptId,
          cash_register_id: activeCashRegister[0].id,
          subtotal: subtotal.toString(),
          discount_amount: discountAmount.toString(),
          payment_charge: paymentCharge.toString(),
          final_total: finalTotal.toString(),
          payment_method_id: input.payment_method_id,
          amount_received: input.amount_received?.toString() || null,
          change_amount: changeAmount?.toString() || null,
          transaction_time: new Date(),
        })
        .returning()
        .execute();

      const transaction = transactionResult[0];

      // Insert transaction items
      for (const item of itemDetails) {
        await tx.insert(transactionItemsTable)
          .values({
            transaction_id: transaction.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price.toString(),
            total_price: item.total_price.toString(),
          })
          .execute();
      }

      // 7. Update cash register totals if payment is cash
      if (paymentMethod[0].name.toLowerCase() === 'cash') {
        const currentCashSales = parseFloat(activeCashRegister[0].cash_sales_total);
        const newCashSalesTotal = currentCashSales + finalTotal;
        const startingCapital = parseFloat(activeCashRegister[0].starting_capital);
        const newExpectedCash = startingCapital + newCashSalesTotal;

        await tx.update(cashRegistersTable)
          .set({
            cash_sales_total: newCashSalesTotal.toString(),
            expected_cash: newExpectedCash.toString()
          })
          .where(eq(cashRegistersTable.id, activeCashRegister[0].id))
          .execute();
      }

      return transaction;
    });

    // Convert numeric fields back to numbers
    const transactionResponse: Transaction = {
      ...result,
      subtotal: parseFloat(result.subtotal),
      discount_amount: parseFloat(result.discount_amount),
      payment_charge: parseFloat(result.payment_charge),
      final_total: parseFloat(result.final_total),
      amount_received: result.amount_received ? parseFloat(result.amount_received) : null,
      change_amount: result.change_amount ? parseFloat(result.change_amount) : null,
    };

    return {
      transaction: transactionResponse,
      receipt_id: receiptId
    };

  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
}

export async function getTransactionById(id: number): Promise<(Transaction & { items: TransactionItem[] }) | null> {
  try {
    // Get transaction with items
    const result = await db.select()
      .from(transactionsTable)
      .leftJoin(transactionItemsTable, eq(transactionsTable.id, transactionItemsTable.transaction_id))
      .where(eq(transactionsTable.id, id))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Group items by transaction
    const transaction = result[0].transactions;
    const items = result
      .filter(row => row.transaction_items !== null)
      .map(row => ({
        ...row.transaction_items!,
        unit_price: parseFloat(row.transaction_items!.unit_price),
        total_price: parseFloat(row.transaction_items!.total_price),
      }));

    return {
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      payment_charge: parseFloat(transaction.payment_charge),
      final_total: parseFloat(transaction.final_total),
      amount_received: transaction.amount_received ? parseFloat(transaction.amount_received) : null,
      change_amount: transaction.change_amount ? parseFloat(transaction.change_amount) : null,
      items
    };

  } catch (error) {
    console.error('Failed to fetch transaction by ID:', error);
    throw error;
  }
}

export async function getTransactionByReceiptId(receiptId: string): Promise<(Transaction & { items: TransactionItem[] }) | null> {
  try {
    // Get transaction with items
    const result = await db.select()
      .from(transactionsTable)
      .leftJoin(transactionItemsTable, eq(transactionsTable.id, transactionItemsTable.transaction_id))
      .where(eq(transactionsTable.receipt_id, receiptId))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Group items by transaction
    const transaction = result[0].transactions;
    const items = result
      .filter(row => row.transaction_items !== null)
      .map(row => ({
        ...row.transaction_items!,
        unit_price: parseFloat(row.transaction_items!.unit_price),
        total_price: parseFloat(row.transaction_items!.total_price),
      }));

    return {
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      payment_charge: parseFloat(transaction.payment_charge),
      final_total: parseFloat(transaction.final_total),
      amount_received: transaction.amount_received ? parseFloat(transaction.amount_received) : null,
      change_amount: transaction.change_amount ? parseFloat(transaction.change_amount) : null,
      items
    };

  } catch (error) {
    console.error('Failed to fetch transaction by receipt ID:', error);
    throw error;
  }
}

export async function getTodayTransactions(): Promise<Transaction[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db.select()
      .from(transactionsTable)
      .where(and(
        gte(transactionsTable.transaction_time, today),
        lte(transactionsTable.transaction_time, tomorrow)
      ))
      .orderBy(desc(transactionsTable.transaction_time))
      .execute();

    return result.map(transaction => ({
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      payment_charge: parseFloat(transaction.payment_charge),
      final_total: parseFloat(transaction.final_total),
      amount_received: transaction.amount_received ? parseFloat(transaction.amount_received) : null,
      change_amount: transaction.change_amount ? parseFloat(transaction.change_amount) : null,
    }));

  } catch (error) {
    console.error('Failed to fetch today transactions:', error);
    throw error;
  }
}

export async function getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
  try {
    const result = await db.select()
      .from(transactionsTable)
      .where(and(
        gte(transactionsTable.transaction_time, startDate),
        lte(transactionsTable.transaction_time, endDate)
      ))
      .orderBy(desc(transactionsTable.transaction_time))
      .execute();

    return result.map(transaction => ({
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      payment_charge: parseFloat(transaction.payment_charge),
      final_total: parseFloat(transaction.final_total),
      amount_received: transaction.amount_received ? parseFloat(transaction.amount_received) : null,
      change_amount: transaction.change_amount ? parseFloat(transaction.change_amount) : null,
    }));

  } catch (error) {
    console.error('Failed to fetch transactions by date range:', error);
    throw error;
  }
}