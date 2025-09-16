import { db } from '../db';
import { productCategoriesTable, productsTable } from '../db/schema';
import { type CreateProductCategoryInput, type UpdateProductCategoryInput, type ProductCategory } from '../schema';
import { eq, asc, count } from 'drizzle-orm';

export async function createProductCategory(input: CreateProductCategoryInput): Promise<ProductCategory> {
  try {
    // Insert new product category
    const result = await db.insert(productCategoriesTable)
      .values({
        name: input.name
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Product category creation failed:', error);
    throw error;
  }
}

export async function getProductCategories(): Promise<ProductCategory[]> {
  try {
    // Fetch all product categories ordered by name
    const categories = await db.select()
      .from(productCategoriesTable)
      .orderBy(asc(productCategoriesTable.name))
      .execute();

    return categories;
  } catch (error) {
    console.error('Failed to fetch product categories:', error);
    throw error;
  }
}

export async function updateProductCategory(input: UpdateProductCategoryInput): Promise<ProductCategory> {
  try {
    // Check if category exists
    const existing = await db.select()
      .from(productCategoriesTable)
      .where(eq(productCategoriesTable.id, input.id))
      .execute();

    if (existing.length === 0) {
      throw new Error('Product category not found');
    }

    // Update category with provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    const result = await db.update(productCategoriesTable)
      .set(updateData)
      .where(eq(productCategoriesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Product category update failed:', error);
    throw error;
  }
}

export async function deleteProductCategory(id: number): Promise<{ success: boolean }> {
  try {
    // Check if category exists
    const existing = await db.select()
      .from(productCategoriesTable)
      .where(eq(productCategoriesTable.id, id))
      .execute();

    if (existing.length === 0) {
      throw new Error('Product category not found');
    }

    // Check if category is being used by any products
    const productCount = await db.select({ count: count() })
      .from(productsTable)
      .where(eq(productsTable.category_id, id))
      .execute();

    if (productCount[0].count > 0) {
      throw new Error('Cannot delete category that is being used by products');
    }

    // Delete the category
    await db.delete(productCategoriesTable)
      .where(eq(productCategoriesTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Product category deletion failed:', error);
    throw error;
  }
}