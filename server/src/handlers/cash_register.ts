import { db } from '../db';
import { cashRegistersTable } from '../db/schema';
import { type OpenCashRegisterInput, type CloseCashRegisterInput, type CashRegister } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export async function openCashRegister(input: OpenCashRegisterInput): Promise<CashRegister> {
  try {
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    // Check if there's already a register open for today
    const existingRegister = await db.select()
      .from(cashRegistersTable)
      .where(
        and(
          eq(cashRegistersTable.date, today),
          eq(cashRegistersTable.is_closed, false)
        )
      )
      .execute();

    if (existingRegister.length > 0) {
      throw new Error('Cash register is already open for today');
    }

    // Create new cash register
    const result = await db.insert(cashRegistersTable)
      .values({
        date: today,
        starting_capital: input.starting_capital.toString(),
        cash_sales_total: '0',
        expected_cash: input.starting_capital.toString(),
        actual_cash_counted: null,
        surplus_shortage: null,
        is_closed: false,
        opened_at: new Date(),
        closed_at: null
      })
      .returning()
      .execute();

    const register = result[0];
    return {
      ...register,
      starting_capital: parseFloat(register.starting_capital),
      cash_sales_total: parseFloat(register.cash_sales_total),
      expected_cash: parseFloat(register.expected_cash),
      actual_cash_counted: register.actual_cash_counted ? parseFloat(register.actual_cash_counted) : null,
      surplus_shortage: register.surplus_shortage ? parseFloat(register.surplus_shortage) : null,
      date: new Date(register.date + 'T00:00:00.000Z') // Convert date string to Date object
    };
  } catch (error) {
    console.error('Opening cash register failed:', error);
    throw error;
  }
}

export async function getCurrentCashRegister(): Promise<CashRegister | null> {
  try {
    const result = await db.select()
      .from(cashRegistersTable)
      .where(eq(cashRegistersTable.is_closed, false))
      .execute();

    if (result.length === 0) {
      return null;
    }

    const register = result[0];
    return {
      ...register,
      starting_capital: parseFloat(register.starting_capital),
      cash_sales_total: parseFloat(register.cash_sales_total),
      expected_cash: parseFloat(register.expected_cash),
      actual_cash_counted: register.actual_cash_counted ? parseFloat(register.actual_cash_counted) : null,
      surplus_shortage: register.surplus_shortage ? parseFloat(register.surplus_shortage) : null,
      date: new Date(register.date + 'T00:00:00.000Z')
    };
  } catch (error) {
    console.error('Getting current cash register failed:', error);
    throw error;
  }
}

export async function getTodayCashRegister(): Promise<CashRegister | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db.select()
      .from(cashRegistersTable)
      .where(eq(cashRegistersTable.date, today))
      .execute();

    if (result.length === 0) {
      return null;
    }

    const register = result[0];
    return {
      ...register,
      starting_capital: parseFloat(register.starting_capital),
      cash_sales_total: parseFloat(register.cash_sales_total),
      expected_cash: parseFloat(register.expected_cash),
      actual_cash_counted: register.actual_cash_counted ? parseFloat(register.actual_cash_counted) : null,
      surplus_shortage: register.surplus_shortage ? parseFloat(register.surplus_shortage) : null,
      date: new Date(register.date + 'T00:00:00.000Z')
    };
  } catch (error) {
    console.error('Getting today cash register failed:', error);
    throw error;
  }
}

export async function closeCashRegister(input: CloseCashRegisterInput): Promise<CashRegister> {
  try {
    // First get the current register data
    const currentRegister = await db.select()
      .from(cashRegistersTable)
      .where(eq(cashRegistersTable.id, input.id))
      .execute();

    if (currentRegister.length === 0) {
      throw new Error('Cash register not found');
    }

    if (currentRegister[0].is_closed) {
      throw new Error('Cash register is already closed');
    }

    const register = currentRegister[0];
    const expectedCash = parseFloat(register.starting_capital) + parseFloat(register.cash_sales_total);
    const surplusShortage = input.actual_cash_counted - expectedCash;

    // Update the register with closing information
    const result = await db.update(cashRegistersTable)
      .set({
        actual_cash_counted: input.actual_cash_counted.toString(),
        surplus_shortage: surplusShortage.toString(),
        is_closed: true,
        closed_at: new Date()
      })
      .where(eq(cashRegistersTable.id, input.id))
      .returning()
      .execute();

    const updatedRegister = result[0];
    return {
      ...updatedRegister,
      starting_capital: parseFloat(updatedRegister.starting_capital),
      cash_sales_total: parseFloat(updatedRegister.cash_sales_total),
      expected_cash: parseFloat(updatedRegister.expected_cash),
      actual_cash_counted: parseFloat(updatedRegister.actual_cash_counted!),
      surplus_shortage: parseFloat(updatedRegister.surplus_shortage!),
      date: new Date(updatedRegister.date + 'T00:00:00.000Z')
    };
  } catch (error) {
    console.error('Closing cash register failed:', error);
    throw error;
  }
}

export async function getCashRegisterHistory(): Promise<CashRegister[]> {
  try {
    const result = await db.select()
      .from(cashRegistersTable)
      .orderBy(desc(cashRegistersTable.date))
      .execute();

    return result.map(register => ({
      ...register,
      starting_capital: parseFloat(register.starting_capital),
      cash_sales_total: parseFloat(register.cash_sales_total),
      expected_cash: parseFloat(register.expected_cash),
      actual_cash_counted: register.actual_cash_counted ? parseFloat(register.actual_cash_counted) : null,
      surplus_shortage: register.surplus_shortage ? parseFloat(register.surplus_shortage) : null,
      date: new Date(register.date + 'T00:00:00.000Z')
    }));
  } catch (error) {
    console.error('Getting cash register history failed:', error);
    throw error;
  }
}