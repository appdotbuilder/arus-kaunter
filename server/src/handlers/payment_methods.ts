import { db } from '../db';
import { paymentMethodsTable, transactionsTable } from '../db/schema';
import { type CreatePaymentMethodInput, type UpdatePaymentMethodInput, type PaymentMethod } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function createPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
  try {
    const result = await db.insert(paymentMethodsTable)
      .values({
        name: input.name,
        transaction_charge_percentage: input.transaction_charge_percentage.toString(),
        is_active: input.is_active
      })
      .returning()
      .execute();

    const paymentMethod = result[0];
    return {
      ...paymentMethod,
      transaction_charge_percentage: parseFloat(paymentMethod.transaction_charge_percentage)
    };
  } catch (error) {
    console.error('Payment method creation failed:', error);
    throw error;
  }
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const result = await db.select()
      .from(paymentMethodsTable)
      .orderBy(desc(paymentMethodsTable.created_at))
      .execute();

    return result.map(method => ({
      ...method,
      transaction_charge_percentage: parseFloat(method.transaction_charge_percentage)
    }));
  } catch (error) {
    console.error('Get payment methods failed:', error);
    throw error;
  }
}

export async function getActivePaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const result = await db.select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.is_active, true))
      .orderBy(desc(paymentMethodsTable.created_at))
      .execute();

    return result.map(method => ({
      ...method,
      transaction_charge_percentage: parseFloat(method.transaction_charge_percentage)
    }));
  } catch (error) {
    console.error('Get active payment methods failed:', error);
    throw error;
  }
}

export async function updatePaymentMethod(input: UpdatePaymentMethodInput): Promise<PaymentMethod> {
  try {
    const updateData: any = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.transaction_charge_percentage !== undefined) {
      updateData.transaction_charge_percentage = input.transaction_charge_percentage.toString();
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    const result = await db.update(paymentMethodsTable)
      .set(updateData)
      .where(eq(paymentMethodsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Payment method with id ${input.id} not found`);
    }

    const paymentMethod = result[0];
    return {
      ...paymentMethod,
      transaction_charge_percentage: parseFloat(paymentMethod.transaction_charge_percentage)
    };
  } catch (error) {
    console.error('Payment method update failed:', error);
    throw error;
  }
}

export async function deletePaymentMethod(id: number): Promise<{ success: boolean }> {
  try {
    // Check if payment method is being used in any transactions
    const transactionCheck = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.payment_method_id, id))
      .limit(1)
      .execute();

    if (transactionCheck.length > 0) {
      throw new Error('Cannot delete payment method that is being used in transactions');
    }

    // Delete the payment method
    const result = await db.delete(paymentMethodsTable)
      .where(eq(paymentMethodsTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Payment method with id ${id} not found`);
    }

    return { success: true };
  } catch (error) {
    console.error('Payment method deletion failed:', error);
    throw error;
  }
}