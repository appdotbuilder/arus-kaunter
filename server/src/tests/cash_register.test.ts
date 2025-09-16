import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { cashRegistersTable } from '../db/schema';
import { type OpenCashRegisterInput, type CloseCashRegisterInput } from '../schema';
import { 
  openCashRegister, 
  getCurrentCashRegister, 
  getTodayCashRegister, 
  closeCashRegister, 
  getCashRegisterHistory 
} from '../handlers/cash_register';
import { eq } from 'drizzle-orm';

const testOpenInput: OpenCashRegisterInput = {
  starting_capital: 500.00
};

const testCloseInput: CloseCashRegisterInput = {
  id: 1,
  actual_cash_counted: 750.00
};

describe('Cash Register Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('openCashRegister', () => {
    it('should open a new cash register', async () => {
      const result = await openCashRegister(testOpenInput);

      expect(result.id).toBeDefined();
      expect(result.starting_capital).toEqual(500.00);
      expect(result.cash_sales_total).toEqual(0);
      expect(result.expected_cash).toEqual(500.00);
      expect(result.actual_cash_counted).toBeNull();
      expect(result.surplus_shortage).toBeNull();
      expect(result.is_closed).toBe(false);
      expect(result.opened_at).toBeInstanceOf(Date);
      expect(result.closed_at).toBeNull();
      expect(result.date).toBeInstanceOf(Date);
    });

    it('should save cash register to database', async () => {
      const result = await openCashRegister(testOpenInput);

      const registers = await db.select()
        .from(cashRegistersTable)
        .where(eq(cashRegistersTable.id, result.id))
        .execute();

      expect(registers).toHaveLength(1);
      expect(parseFloat(registers[0].starting_capital)).toEqual(500.00);
      expect(parseFloat(registers[0].cash_sales_total)).toEqual(0);
      expect(registers[0].is_closed).toBe(false);
      expect(registers[0].opened_at).toBeInstanceOf(Date);
    });

    it('should prevent opening multiple registers for same day', async () => {
      await openCashRegister(testOpenInput);

      await expect(openCashRegister(testOpenInput))
        .rejects.toThrow(/already open for today/i);
    });

    it('should handle numeric conversions correctly', async () => {
      const result = await openCashRegister(testOpenInput);

      expect(typeof result.starting_capital).toBe('number');
      expect(typeof result.cash_sales_total).toBe('number');
      expect(typeof result.expected_cash).toBe('number');
    });
  });

  describe('getCurrentCashRegister', () => {
    it('should return null when no register is open', async () => {
      const result = await getCurrentCashRegister();
      expect(result).toBeNull();
    });

    it('should return current open register', async () => {
      const opened = await openCashRegister(testOpenInput);
      
      const result = await getCurrentCashRegister();
      
      expect(result).not.toBeNull();
      expect(result!.id).toEqual(opened.id);
      expect(result!.starting_capital).toEqual(500.00);
      expect(result!.is_closed).toBe(false);
    });

    it('should not return closed registers', async () => {
      const opened = await openCashRegister(testOpenInput);
      await closeCashRegister({ id: opened.id, actual_cash_counted: 600.00 });
      
      const result = await getCurrentCashRegister();
      expect(result).toBeNull();
    });
  });

  describe('getTodayCashRegister', () => {
    it('should return null when no register exists for today', async () => {
      const result = await getTodayCashRegister();
      expect(result).toBeNull();
    });

    it('should return today register when open', async () => {
      const opened = await openCashRegister(testOpenInput);
      
      const result = await getTodayCashRegister();
      
      expect(result).not.toBeNull();
      expect(result!.id).toEqual(opened.id);
      expect(result!.is_closed).toBe(false);
    });

    it('should return today register even when closed', async () => {
      const opened = await openCashRegister(testOpenInput);
      const closed = await closeCashRegister({ id: opened.id, actual_cash_counted: 600.00 });
      
      const result = await getTodayCashRegister();
      
      expect(result).not.toBeNull();
      expect(result!.id).toEqual(closed.id);
      expect(result!.is_closed).toBe(true);
    });
  });

  describe('closeCashRegister', () => {
    it('should close an open cash register', async () => {
      const opened = await openCashRegister(testOpenInput);
      
      const result = await closeCashRegister({
        id: opened.id,
        actual_cash_counted: 750.00
      });

      expect(result.id).toEqual(opened.id);
      expect(result.actual_cash_counted).toEqual(750.00);
      expect(result.surplus_shortage).toEqual(250.00); // 750 - (500 + 0)
      expect(result.is_closed).toBe(true);
      expect(result.closed_at).toBeInstanceOf(Date);
    });

    it('should calculate surplus correctly', async () => {
      const opened = await openCashRegister(testOpenInput);
      
      const result = await closeCashRegister({
        id: opened.id,
        actual_cash_counted: 800.00
      });

      expect(result.surplus_shortage).toEqual(300.00); // 800 - 500
    });

    it('should calculate shortage correctly', async () => {
      const opened = await openCashRegister(testOpenInput);
      
      const result = await closeCashRegister({
        id: opened.id,
        actual_cash_counted: 450.00
      });

      expect(result.surplus_shortage).toEqual(-50.00); // 450 - 500
    });

    it('should update database record', async () => {
      const opened = await openCashRegister(testOpenInput);
      await closeCashRegister({
        id: opened.id,
        actual_cash_counted: 750.00
      });

      const registers = await db.select()
        .from(cashRegistersTable)
        .where(eq(cashRegistersTable.id, opened.id))
        .execute();

      expect(registers).toHaveLength(1);
      expect(registers[0].is_closed).toBe(true);
      expect(parseFloat(registers[0].actual_cash_counted!)).toEqual(750.00);
      expect(parseFloat(registers[0].surplus_shortage!)).toEqual(250.00);
      expect(registers[0].closed_at).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent register', async () => {
      await expect(closeCashRegister({
        id: 999,
        actual_cash_counted: 500.00
      })).rejects.toThrow(/not found/i);
    });

    it('should throw error for already closed register', async () => {
      const opened = await openCashRegister(testOpenInput);
      await closeCashRegister({
        id: opened.id,
        actual_cash_counted: 600.00
      });

      await expect(closeCashRegister({
        id: opened.id,
        actual_cash_counted: 700.00
      })).rejects.toThrow(/already closed/i);
    });
  });

  describe('getCashRegisterHistory', () => {
    it('should return empty array when no registers exist', async () => {
      const result = await getCashRegisterHistory();
      expect(result).toEqual([]);
    });

    it('should return all registers ordered by date descending', async () => {
      // Create multiple registers by manually inserting with different dates
      await db.insert(cashRegistersTable)
        .values([
          {
            date: '2024-01-01',
            starting_capital: '400.00',
            cash_sales_total: '200.00',
            expected_cash: '600.00',
            actual_cash_counted: '590.00',
            surplus_shortage: '-10.00',
            is_closed: true,
            opened_at: new Date('2024-01-01T08:00:00Z'),
            closed_at: new Date('2024-01-01T18:00:00Z')
          },
          {
            date: '2024-01-02',
            starting_capital: '500.00',
            cash_sales_total: '300.00',
            expected_cash: '800.00',
            actual_cash_counted: '810.00',
            surplus_shortage: '10.00',
            is_closed: true,
            opened_at: new Date('2024-01-02T08:00:00Z'),
            closed_at: new Date('2024-01-02T18:00:00Z')
          }
        ])
        .execute();

      const result = await getCashRegisterHistory();

      expect(result).toHaveLength(2);
      // Should be ordered by date descending (newest first)
      expect(result[0].date.toISOString().split('T')[0]).toEqual('2024-01-02');
      expect(result[1].date.toISOString().split('T')[0]).toEqual('2024-01-01');
      
      // Verify numeric conversions
      expect(typeof result[0].starting_capital).toBe('number');
      expect(typeof result[0].cash_sales_total).toBe('number');
      expect(typeof result[0].expected_cash).toBe('number');
      expect(typeof result[0].actual_cash_counted).toBe('number');
      expect(typeof result[0].surplus_shortage).toBe('number');
    });

    it('should include both open and closed registers', async () => {
      const opened = await openCashRegister(testOpenInput);
      
      // Manually insert a closed register for previous day
      await db.insert(cashRegistersTable)
        .values({
          date: '2024-01-01',
          starting_capital: '400.00',
          cash_sales_total: '200.00',
          expected_cash: '600.00',
          actual_cash_counted: '590.00',
          surplus_shortage: '-10.00',
          is_closed: true,
          opened_at: new Date('2024-01-01T08:00:00Z'),
          closed_at: new Date('2024-01-01T18:00:00Z')
        })
        .execute();

      const result = await getCashRegisterHistory();

      expect(result).toHaveLength(2);
      
      // One should be open, one closed
      const openRegister = result.find(r => !r.is_closed);
      const closedRegister = result.find(r => r.is_closed);
      
      expect(openRegister).toBeDefined();
      expect(closedRegister).toBeDefined();
      expect(openRegister!.id).toEqual(opened.id);
    });
  });
});