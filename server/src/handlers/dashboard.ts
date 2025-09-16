import { db } from '../db';
import { 
  transactionsTable, 
  transactionItemsTable, 
  productsTable, 
  cashRegistersTable 
} from '../db/schema';
import { type DashboardStats } from '../schema';
import { eq, sql, desc, gte, and, lt } from 'drizzle-orm';

export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Get today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Get today's sales and transaction count
    const todaysStatsResult = await db
      .select({
        total_sales: sql<string>`COALESCE(SUM(${transactionsTable.final_total}), 0)`,
        transaction_count: sql<string>`COUNT(*)`
      })
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.transaction_time, today),
          lt(transactionsTable.transaction_time, tomorrow)
        )
      )
      .execute();

    const todaysStats = todaysStatsResult[0];
    const todays_sales = parseFloat(todaysStats.total_sales);
    const todays_transactions = parseInt(todaysStats.transaction_count);

    // 2. Get top 5 best-selling products by total quantity
    const topProductsResult = await db
      .select({
        product_id: productsTable.id,
        product_name: productsTable.name,
        total_quantity: sql<string>`SUM(${transactionItemsTable.quantity})`,
        total_sales: sql<string>`SUM(${transactionItemsTable.total_price})`
      })
      .from(transactionItemsTable)
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .groupBy(productsTable.id, productsTable.name)
      .orderBy(desc(sql`SUM(${transactionItemsTable.quantity})`))
      .limit(5)
      .execute();

    const top_products = topProductsResult.map(product => ({
      product_id: product.product_id,
      product_name: product.product_name,
      total_quantity: parseInt(product.total_quantity),
      total_sales: parseFloat(product.total_sales)
    }));

    // 3. Get weekly sales data for the last 7 days
    const weeklyData: Array<{ date: Date; total_sales: number }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dailySalesResult = await db
        .select({
          total_sales: sql<string>`COALESCE(SUM(${transactionsTable.final_total}), 0)`
        })
        .from(transactionsTable)
        .where(
          and(
            gte(transactionsTable.transaction_time, date),
            lt(transactionsTable.transaction_time, nextDate)
          )
        )
        .execute();

      weeklyData.push({
        date: new Date(date),
        total_sales: parseFloat(dailySalesResult[0].total_sales)
      });
    }

    // 4. Get current cash register status
    const currentRegisterResult = await db
      .select({
        id: cashRegistersTable.id,
        is_closed: cashRegistersTable.is_closed
      })
      .from(cashRegistersTable)
      .orderBy(desc(cashRegistersTable.opened_at))
      .limit(1)
      .execute();

    const cash_register_status = {
      is_open: currentRegisterResult.length > 0 && !currentRegisterResult[0].is_closed,
      current_register_id: currentRegisterResult.length > 0 ? currentRegisterResult[0].id : null
    };

    return {
      todays_sales,
      todays_transactions,
      top_products,
      weekly_sales: weeklyData,
      cash_register_status
    };
  } catch (error) {
    console.error('Dashboard stats calculation failed:', error);
    throw error;
  }
};