import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { automaticDiscountsTable } from '../db/schema';
import { type CreateAutomaticDiscountInput, type UpdateAutomaticDiscountInput } from '../schema';
import { 
  createAutomaticDiscount, 
  getAutomaticDiscounts, 
  getActiveAutomaticDiscounts,
  updateAutomaticDiscount,
  deleteAutomaticDiscount 
} from '../handlers/automatic_discounts';
import { eq } from 'drizzle-orm';

const testDiscountInput: CreateAutomaticDiscountInput = {
  minimum_amount: 100.00,
  discount_percentage: 10.5,
  is_active: true
};

const secondTestDiscountInput: CreateAutomaticDiscountInput = {
  minimum_amount: 200.00,
  discount_percentage: 15.0,
  is_active: false
};

describe('createAutomaticDiscount', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an automatic discount with all fields', async () => {
    const result = await createAutomaticDiscount(testDiscountInput);

    expect(result.minimum_amount).toEqual(100.00);
    expect(result.discount_percentage).toEqual(10.5);
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Verify numeric types
    expect(typeof result.minimum_amount).toBe('number');
    expect(typeof result.discount_percentage).toBe('number');
  });

  it('should create discount with default is_active value', async () => {
    const inputWithDefaults: CreateAutomaticDiscountInput = {
      minimum_amount: 50.00,
      discount_percentage: 5.0,
      is_active: true // Zod has applied the default
    };

    const result = await createAutomaticDiscount(inputWithDefaults);
    expect(result.is_active).toEqual(true);
  });

  it('should save discount to database', async () => {
    const result = await createAutomaticDiscount(testDiscountInput);

    const discounts = await db.select()
      .from(automaticDiscountsTable)
      .where(eq(automaticDiscountsTable.id, result.id))
      .execute();

    expect(discounts).toHaveLength(1);
    expect(parseFloat(discounts[0].minimum_amount)).toEqual(100.00);
    expect(parseFloat(discounts[0].discount_percentage)).toEqual(10.5);
    expect(discounts[0].is_active).toEqual(true);
    expect(discounts[0].created_at).toBeInstanceOf(Date);
  });
});

describe('getAutomaticDiscounts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no discounts exist', async () => {
    const result = await getAutomaticDiscounts();
    expect(result).toEqual([]);
  });

  it('should return all discounts ordered by minimum_amount ascending', async () => {
    // Create discounts in reverse order to test sorting
    const discount2 = await createAutomaticDiscount(secondTestDiscountInput);
    const discount1 = await createAutomaticDiscount(testDiscountInput);

    const results = await getAutomaticDiscounts();

    expect(results).toHaveLength(2);
    // Should be ordered by minimum_amount ascending
    expect(results[0].minimum_amount).toEqual(100.00); // First discount
    expect(results[1].minimum_amount).toEqual(200.00); // Second discount
    expect(results[0].id).toEqual(discount1.id);
    expect(results[1].id).toEqual(discount2.id);
  });

  it('should return both active and inactive discounts', async () => {
    await createAutomaticDiscount(testDiscountInput);
    await createAutomaticDiscount(secondTestDiscountInput);

    const results = await getAutomaticDiscounts();

    expect(results).toHaveLength(2);
    expect(results.some(d => d.is_active === true)).toBe(true);
    expect(results.some(d => d.is_active === false)).toBe(true);
  });

  it('should convert numeric fields correctly', async () => {
    await createAutomaticDiscount(testDiscountInput);

    const results = await getAutomaticDiscounts();
    const discount = results[0];

    expect(typeof discount.minimum_amount).toBe('number');
    expect(typeof discount.discount_percentage).toBe('number');
    expect(discount.minimum_amount).toEqual(100.00);
    expect(discount.discount_percentage).toEqual(10.5);
  });
});

describe('getActiveAutomaticDiscounts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no active discounts exist', async () => {
    // Create an inactive discount
    await createAutomaticDiscount(secondTestDiscountInput);

    const result = await getActiveAutomaticDiscounts();
    expect(result).toEqual([]);
  });

  it('should return only active discounts ordered by minimum_amount descending', async () => {
    // Create active and inactive discounts
    await createAutomaticDiscount(testDiscountInput); // active, 100.00
    await createAutomaticDiscount(secondTestDiscountInput); // inactive, 200.00
    
    const thirdDiscount = await createAutomaticDiscount({
      minimum_amount: 300.00,
      discount_percentage: 20.0,
      is_active: true
    });

    const results = await getActiveAutomaticDiscounts();

    expect(results).toHaveLength(2);
    // Should be ordered by minimum_amount descending for best match first
    expect(results[0].minimum_amount).toEqual(300.00);
    expect(results[1].minimum_amount).toEqual(100.00);
    expect(results[0].id).toEqual(thirdDiscount.id);
    
    // All returned discounts should be active
    results.forEach(discount => {
      expect(discount.is_active).toBe(true);
    });
  });

  it('should convert numeric fields correctly', async () => {
    await createAutomaticDiscount(testDiscountInput);

    const results = await getActiveAutomaticDiscounts();
    const discount = results[0];

    expect(typeof discount.minimum_amount).toBe('number');
    expect(typeof discount.discount_percentage).toBe('number');
  });
});

describe('updateAutomaticDiscount', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update discount with provided fields', async () => {
    const discount = await createAutomaticDiscount(testDiscountInput);

    const updateInput: UpdateAutomaticDiscountInput = {
      id: discount.id,
      minimum_amount: 150.00,
      discount_percentage: 12.5
    };

    const result = await updateAutomaticDiscount(updateInput);

    expect(result.id).toEqual(discount.id);
    expect(result.minimum_amount).toEqual(150.00);
    expect(result.discount_percentage).toEqual(12.5);
    expect(result.is_active).toEqual(true); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(discount.updated_at.getTime());
  });

  it('should update only is_active field', async () => {
    const discount = await createAutomaticDiscount(testDiscountInput);

    const updateInput: UpdateAutomaticDiscountInput = {
      id: discount.id,
      is_active: false
    };

    const result = await updateAutomaticDiscount(updateInput);

    expect(result.id).toEqual(discount.id);
    expect(result.minimum_amount).toEqual(100.00); // Unchanged
    expect(result.discount_percentage).toEqual(10.5); // Unchanged
    expect(result.is_active).toEqual(false); // Updated
  });

  it('should update discount in database', async () => {
    const discount = await createAutomaticDiscount(testDiscountInput);

    const updateInput: UpdateAutomaticDiscountInput = {
      id: discount.id,
      minimum_amount: 175.00,
      is_active: false
    };

    await updateAutomaticDiscount(updateInput);

    const discounts = await db.select()
      .from(automaticDiscountsTable)
      .where(eq(automaticDiscountsTable.id, discount.id))
      .execute();

    expect(discounts).toHaveLength(1);
    expect(parseFloat(discounts[0].minimum_amount)).toEqual(175.00);
    expect(discounts[0].is_active).toEqual(false);
    expect(parseFloat(discounts[0].discount_percentage)).toEqual(10.5); // Unchanged
  });

  it('should throw error when discount not found', async () => {
    const updateInput: UpdateAutomaticDiscountInput = {
      id: 999,
      minimum_amount: 150.00
    };

    await expect(updateAutomaticDiscount(updateInput))
      .rejects
      .toThrow(/not found/i);
  });

  it('should convert numeric fields correctly', async () => {
    const discount = await createAutomaticDiscount(testDiscountInput);

    const updateInput: UpdateAutomaticDiscountInput = {
      id: discount.id,
      minimum_amount: 175.50,
      discount_percentage: 8.75
    };

    const result = await updateAutomaticDiscount(updateInput);

    expect(typeof result.minimum_amount).toBe('number');
    expect(typeof result.discount_percentage).toBe('number');
    expect(result.minimum_amount).toEqual(175.50);
    expect(result.discount_percentage).toEqual(8.75);
  });
});

describe('deleteAutomaticDiscount', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete discount and return success', async () => {
    const discount = await createAutomaticDiscount(testDiscountInput);

    const result = await deleteAutomaticDiscount(discount.id);

    expect(result.success).toBe(true);

    // Verify discount was deleted from database
    const discounts = await db.select()
      .from(automaticDiscountsTable)
      .where(eq(automaticDiscountsTable.id, discount.id))
      .execute();

    expect(discounts).toHaveLength(0);
  });

  it('should return success even when discount does not exist', async () => {
    const result = await deleteAutomaticDiscount(999);
    expect(result.success).toBe(true);
  });

  it('should not affect other discounts', async () => {
    const discount1 = await createAutomaticDiscount(testDiscountInput);
    const discount2 = await createAutomaticDiscount(secondTestDiscountInput);

    await deleteAutomaticDiscount(discount1.id);

    // Verify only the target discount was deleted
    const remainingDiscounts = await db.select()
      .from(automaticDiscountsTable)
      .execute();

    expect(remainingDiscounts).toHaveLength(1);
    expect(remainingDiscounts[0].id).toEqual(discount2.id);
  });
});