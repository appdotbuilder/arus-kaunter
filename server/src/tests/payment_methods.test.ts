import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentMethodsTable, transactionsTable, cashRegistersTable } from '../db/schema';
import { type CreatePaymentMethodInput, type UpdatePaymentMethodInput } from '../schema';
import { 
  createPaymentMethod, 
  getPaymentMethods, 
  getActivePaymentMethods, 
  updatePaymentMethod, 
  deletePaymentMethod 
} from '../handlers/payment_methods';
import { eq } from 'drizzle-orm';

// Test input data
const testPaymentMethodInput: CreatePaymentMethodInput = {
  name: 'Credit Card',
  transaction_charge_percentage: 2.5,
  is_active: true
};

const testPaymentMethodInput2: CreatePaymentMethodInput = {
  name: 'Cash',
  transaction_charge_percentage: 0,
  is_active: true
};

const inactivePaymentMethodInput: CreatePaymentMethodInput = {
  name: 'Inactive Method',
  transaction_charge_percentage: 1.5,
  is_active: false
};

describe('Payment Methods Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createPaymentMethod', () => {
    it('should create a payment method', async () => {
      const result = await createPaymentMethod(testPaymentMethodInput);

      expect(result.name).toEqual('Credit Card');
      expect(result.transaction_charge_percentage).toEqual(2.5);
      expect(typeof result.transaction_charge_percentage).toBe('number');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save payment method to database', async () => {
      const result = await createPaymentMethod(testPaymentMethodInput);

      const methods = await db.select()
        .from(paymentMethodsTable)
        .where(eq(paymentMethodsTable.id, result.id))
        .execute();

      expect(methods).toHaveLength(1);
      expect(methods[0].name).toEqual('Credit Card');
      expect(parseFloat(methods[0].transaction_charge_percentage)).toEqual(2.5);
      expect(methods[0].is_active).toBe(true);
    });

    it('should handle zero transaction charge percentage', async () => {
      const result = await createPaymentMethod(testPaymentMethodInput2);

      expect(result.transaction_charge_percentage).toEqual(0);
      expect(typeof result.transaction_charge_percentage).toBe('number');
    });

    it('should create inactive payment method', async () => {
      const result = await createPaymentMethod(inactivePaymentMethodInput);

      expect(result.name).toEqual('Inactive Method');
      expect(result.is_active).toBe(false);
    });

    it('should reject duplicate payment method names', async () => {
      await createPaymentMethod(testPaymentMethodInput);
      
      expect(createPaymentMethod(testPaymentMethodInput)).rejects.toThrow(/duplicate key value violates unique constraint|unique constraint/i);
    });
  });

  describe('getPaymentMethods', () => {
    it('should return empty array when no payment methods exist', async () => {
      const result = await getPaymentMethods();
      expect(result).toEqual([]);
    });

    it('should return all payment methods', async () => {
      const method1 = await createPaymentMethod(testPaymentMethodInput);
      const method2 = await createPaymentMethod(inactivePaymentMethodInput);

      const result = await getPaymentMethods();

      expect(result).toHaveLength(2);
      expect(result.find(m => m.id === method1.id)).toBeDefined();
      expect(result.find(m => m.id === method2.id)).toBeDefined();
      
      // Check numeric conversion
      result.forEach(method => {
        expect(typeof method.transaction_charge_percentage).toBe('number');
      });
    });

    it('should return methods ordered by creation date (newest first)', async () => {
      const method1 = await createPaymentMethod(testPaymentMethodInput);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const method2 = await createPaymentMethod(testPaymentMethodInput2);

      const result = await getPaymentMethods();

      expect(result).toHaveLength(2);
      expect(result[0].id).toEqual(method2.id); // Newest first
      expect(result[1].id).toEqual(method1.id);
    });
  });

  describe('getActivePaymentMethods', () => {
    it('should return empty array when no active payment methods exist', async () => {
      await createPaymentMethod(inactivePaymentMethodInput);
      
      const result = await getActivePaymentMethods();
      expect(result).toEqual([]);
    });

    it('should return only active payment methods', async () => {
      const activeMethod = await createPaymentMethod(testPaymentMethodInput);
      await createPaymentMethod(inactivePaymentMethodInput);

      const result = await getActivePaymentMethods();

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(activeMethod.id);
      expect(result[0].is_active).toBe(true);
      expect(typeof result[0].transaction_charge_percentage).toBe('number');
    });

    it('should return active methods ordered by creation date', async () => {
      const method1 = await createPaymentMethod(testPaymentMethodInput);
      await new Promise(resolve => setTimeout(resolve, 10));
      const method2 = await createPaymentMethod(testPaymentMethodInput2);

      const result = await getActivePaymentMethods();

      expect(result).toHaveLength(2);
      expect(result[0].id).toEqual(method2.id); // Newest first
      expect(result[1].id).toEqual(method1.id);
    });
  });

  describe('updatePaymentMethod', () => {
    it('should update payment method name', async () => {
      const method = await createPaymentMethod(testPaymentMethodInput);

      const updateInput: UpdatePaymentMethodInput = {
        id: method.id,
        name: 'Updated Card'
      };

      const result = await updatePaymentMethod(updateInput);

      expect(result.id).toEqual(method.id);
      expect(result.name).toEqual('Updated Card');
      expect(result.transaction_charge_percentage).toEqual(2.5); // Unchanged
      expect(result.is_active).toBe(true); // Unchanged
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should update transaction charge percentage', async () => {
      const method = await createPaymentMethod(testPaymentMethodInput);

      const updateInput: UpdatePaymentMethodInput = {
        id: method.id,
        transaction_charge_percentage: 3.5
      };

      const result = await updatePaymentMethod(updateInput);

      expect(result.transaction_charge_percentage).toEqual(3.5);
      expect(typeof result.transaction_charge_percentage).toBe('number');
      expect(result.name).toEqual('Credit Card'); // Unchanged
    });

    it('should update active status', async () => {
      const method = await createPaymentMethod(testPaymentMethodInput);

      const updateInput: UpdatePaymentMethodInput = {
        id: method.id,
        is_active: false
      };

      const result = await updatePaymentMethod(updateInput);

      expect(result.is_active).toBe(false);
      expect(result.name).toEqual('Credit Card'); // Unchanged
    });

    it('should update multiple fields at once', async () => {
      const method = await createPaymentMethod(testPaymentMethodInput);

      const updateInput: UpdatePaymentMethodInput = {
        id: method.id,
        name: 'New Name',
        transaction_charge_percentage: 1.8,
        is_active: false
      };

      const result = await updatePaymentMethod(updateInput);

      expect(result.name).toEqual('New Name');
      expect(result.transaction_charge_percentage).toEqual(1.8);
      expect(result.is_active).toBe(false);
    });

    it('should persist updates to database', async () => {
      const method = await createPaymentMethod(testPaymentMethodInput);

      const updateInput: UpdatePaymentMethodInput = {
        id: method.id,
        name: 'Database Updated'
      };

      await updatePaymentMethod(updateInput);

      const methods = await db.select()
        .from(paymentMethodsTable)
        .where(eq(paymentMethodsTable.id, method.id))
        .execute();

      expect(methods[0].name).toEqual('Database Updated');
    });

    it('should throw error for non-existent payment method', async () => {
      const updateInput: UpdatePaymentMethodInput = {
        id: 99999,
        name: 'Non-existent'
      };

      expect(updatePaymentMethod(updateInput)).rejects.toThrow(/not found/i);
    });
  });

  describe('deletePaymentMethod', () => {
    it('should delete payment method successfully', async () => {
      const method = await createPaymentMethod(testPaymentMethodInput);

      const result = await deletePaymentMethod(method.id);

      expect(result.success).toBe(true);

      // Verify deletion from database
      const methods = await db.select()
        .from(paymentMethodsTable)
        .where(eq(paymentMethodsTable.id, method.id))
        .execute();

      expect(methods).toHaveLength(0);
    });

    it('should throw error for non-existent payment method', async () => {
      expect(deletePaymentMethod(99999)).rejects.toThrow(/not found/i);
    });

    it('should prevent deletion of payment method used in transactions', async () => {
      // Create a payment method
      const method = await createPaymentMethod(testPaymentMethodInput);

      // Create a cash register first
      const cashRegister = await db.insert(cashRegistersTable)
        .values({
          date: new Date().toISOString().split('T')[0],
          starting_capital: '100.00'
        })
        .returning()
        .execute();

      // Create a transaction using this payment method
      await db.insert(transactionsTable)
        .values({
          receipt_id: 'TEST001',
          cash_register_id: cashRegister[0].id,
          subtotal: '50.00',
          final_total: '50.00',
          payment_method_id: method.id
        })
        .execute();

      // Attempt to delete should fail
      expect(deletePaymentMethod(method.id)).rejects.toThrow(/cannot delete payment method that is being used/i);
    });
  });
});