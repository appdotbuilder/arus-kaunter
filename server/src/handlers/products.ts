import { db } from '../db';
import { productsTable, productCategoriesTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type Product } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

// Helper function to generate unique product ID
const generateProductId = async (): Promise<string> => {
  const lastProduct = await db.select({ product_id: productsTable.product_id })
    .from(productsTable)
    .orderBy(productsTable.id)
    .limit(1)
    .execute();

  if (lastProduct.length === 0) {
    return 'P001';
  }

  // Extract number from last product ID and increment
  const lastId = lastProduct[0].product_id;
  const match = lastId.match(/P(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1]) + 1;
    return `P${nextNum.toString().padStart(3, '0')}`;
  }

  return 'P001';
};

export async function createProduct(input: CreateProductInput): Promise<Product> {
  try {
    // Validate category exists
    const category = await db.select()
      .from(productCategoriesTable)
      .where(eq(productCategoriesTable.id, input.category_id))
      .execute();

    if (category.length === 0) {
      throw new Error(`Category with id ${input.category_id} does not exist`);
    }

    // Generate product_id if not provided
    const productId = input.product_id || await generateProductId();

    // Calculate price after discount
    const discountPercentage = input.discount_percentage ?? 0;
    const priceAfterDiscount = input.original_price * (1 - discountPercentage / 100);

    // Insert product record
    const result = await db.insert(productsTable)
      .values({
        product_id: productId,
        name: input.name,
        category_id: input.category_id,
        original_price: input.original_price.toString(),
        discount_percentage: discountPercentage.toString(),
        price_after_discount: priceAfterDiscount.toString(),
        image_url: input.image_url || null,
        is_active: true
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      original_price: parseFloat(product.original_price),
      discount_percentage: parseFloat(product.discount_percentage),
      price_after_discount: parseFloat(product.price_after_discount)
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
}

export async function getProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .execute();

    return results.map(product => ({
      ...product,
      original_price: parseFloat(product.original_price),
      discount_percentage: parseFloat(product.discount_percentage),
      price_after_discount: parseFloat(product.price_after_discount)
    }));
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
}

export async function getActiveProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.is_active, true))
      .execute();

    return results.map(product => ({
      ...product,
      original_price: parseFloat(product.original_price),
      discount_percentage: parseFloat(product.discount_percentage),
      price_after_discount: parseFloat(product.price_after_discount)
    }));
  } catch (error) {
    console.error('Failed to fetch active products:', error);
    throw error;
  }
}

export async function getProductsByCategory(categoryId: number): Promise<Product[]> {
  try {
    // Validate category exists
    const category = await db.select()
      .from(productCategoriesTable)
      .where(eq(productCategoriesTable.id, categoryId))
      .execute();

    if (category.length === 0) {
      throw new Error(`Category with id ${categoryId} does not exist`);
    }

    const results = await db.select()
      .from(productsTable)
      .where(and(
        eq(productsTable.category_id, categoryId),
        eq(productsTable.is_active, true)
      ))
      .execute();

    return results.map(product => ({
      ...product,
      original_price: parseFloat(product.original_price),
      discount_percentage: parseFloat(product.discount_percentage),
      price_after_discount: parseFloat(product.price_after_discount)
    }));
  } catch (error) {
    console.error('Failed to fetch products by category:', error);
    throw error;
  }
}

export async function getProductById(id: number): Promise<Product | null> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const product = results[0];
    return {
      ...product,
      original_price: parseFloat(product.original_price),
      discount_percentage: parseFloat(product.discount_percentage),
      price_after_discount: parseFloat(product.price_after_discount)
    };
  } catch (error) {
    console.error('Failed to fetch product by ID:', error);
    throw error;
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  try {
    // Check if product exists
    const existingProduct = await getProductById(input.id);
    if (!existingProduct) {
      throw new Error(`Product with id ${input.id} does not exist`);
    }

    // If category_id is being updated, validate it exists
    if (input.category_id) {
      const category = await db.select()
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.id, input.category_id))
        .execute();

      if (category.length === 0) {
        throw new Error(`Category with id ${input.category_id} does not exist`);
      }
    }

    // Build update values
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.product_id !== undefined) updateValues.product_id = input.product_id;
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.category_id !== undefined) updateValues.category_id = input.category_id;
    if (input.image_url !== undefined) updateValues.image_url = input.image_url;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    // Handle price and discount updates
    const originalPrice = input.original_price !== undefined ? input.original_price : existingProduct.original_price;
    const discountPercentage = input.discount_percentage !== undefined ? input.discount_percentage : existingProduct.discount_percentage;

    if (input.original_price !== undefined) {
      updateValues.original_price = input.original_price.toString();
    }
    if (input.discount_percentage !== undefined) {
      updateValues.discount_percentage = input.discount_percentage.toString();
    }

    // Recalculate price_after_discount if price or discount changed
    if (input.original_price !== undefined || input.discount_percentage !== undefined) {
      const priceAfterDiscount = originalPrice * (1 - discountPercentage / 100);
      updateValues.price_after_discount = priceAfterDiscount.toString();
    }

    // Update product record
    const result = await db.update(productsTable)
      .set(updateValues)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      original_price: parseFloat(product.original_price),
      discount_percentage: parseFloat(product.discount_percentage),
      price_after_discount: parseFloat(product.price_after_discount)
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
}

export async function deleteProduct(id: number): Promise<{ success: boolean }> {
  try {
    // Check if product exists
    const existingProduct = await getProductById(id);
    if (!existingProduct) {
      throw new Error(`Product with id ${id} does not exist`);
    }

    // Soft delete by setting is_active = false
    await db.update(productsTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Product deletion failed:', error);
    throw error;
  }
}