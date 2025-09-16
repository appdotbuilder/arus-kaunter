import { db } from '../db';
import { automaticDiscountsTable } from '../db/schema';
import { type CreateAutomaticDiscountInput, type UpdateAutomaticDiscountInput, type AutomaticDiscount } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

export async function createAutomaticDiscount(input: CreateAutomaticDiscountInput): Promise<AutomaticDiscount> {
  try {
    // Insert automatic discount record
    const result = await db.insert(automaticDiscountsTable)
      .values({
        minimum_amount: input.minimum_amount.toString(),
        discount_percentage: input.discount_percentage.toString(),
        is_active: input.is_active
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const discount = result[0];
    return {
      ...discount,
      minimum_amount: parseFloat(discount.minimum_amount),
      discount_percentage: parseFloat(discount.discount_percentage)
    };
  } catch (error) {
    console.error('Automatic discount creation failed:', error);
    throw error;
  }
}

export async function getAutomaticDiscounts(): Promise<AutomaticDiscount[]> {
  try {
    const results = await db.select()
      .from(automaticDiscountsTable)
      .orderBy(automaticDiscountsTable.minimum_amount)
      .execute();

    return results.map(discount => ({
      ...discount,
      minimum_amount: parseFloat(discount.minimum_amount),
      discount_percentage: parseFloat(discount.discount_percentage)
    }));
  } catch (error) {
    console.error('Failed to fetch automatic discounts:', error);
    throw error;
  }
}

export async function getActiveAutomaticDiscounts(): Promise<AutomaticDiscount[]> {
  try {
    const results = await db.select()
      .from(automaticDiscountsTable)
      .where(eq(automaticDiscountsTable.is_active, true))
      .orderBy(desc(automaticDiscountsTable.minimum_amount))
      .execute();

    return results.map(discount => ({
      ...discount,
      minimum_amount: parseFloat(discount.minimum_amount),
      discount_percentage: parseFloat(discount.discount_percentage)
    }));
  } catch (error) {
    console.error('Failed to fetch active automatic discounts:', error);
    throw error;
  }
}

export async function updateAutomaticDiscount(input: UpdateAutomaticDiscountInput): Promise<AutomaticDiscount> {
  try {
    // Build update values object with only provided fields
    const updateValues: any = {};
    
    if (input.minimum_amount !== undefined) {
      updateValues.minimum_amount = input.minimum_amount.toString();
    }
    if (input.discount_percentage !== undefined) {
      updateValues.discount_percentage = input.discount_percentage.toString();
    }
    if (input.is_active !== undefined) {
      updateValues.is_active = input.is_active;
    }

    // Always update the updated_at timestamp
    updateValues.updated_at = new Date();

    const result = await db.update(automaticDiscountsTable)
      .set(updateValues)
      .where(eq(automaticDiscountsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Automatic discount with id ${input.id} not found`);
    }

    // Convert numeric fields back to numbers before returning
    const discount = result[0];
    return {
      ...discount,
      minimum_amount: parseFloat(discount.minimum_amount),
      discount_percentage: parseFloat(discount.discount_percentage)
    };
  } catch (error) {
    console.error('Automatic discount update failed:', error);
    throw error;
  }
}

export async function deleteAutomaticDiscount(id: number): Promise<{ success: boolean }> {
  try {
    const result = await db.delete(automaticDiscountsTable)
      .where(eq(automaticDiscountsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Automatic discount deletion failed:', error);
    throw error;
  }
}