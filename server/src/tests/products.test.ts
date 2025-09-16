import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, productCategoriesTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput } from '../schema';
import { 
  createProduct, 
  getProducts, 
  getActiveProducts, 
  getProductsByCategory, 
  getProductById, 
  updateProduct, 
  deleteProduct 
} from '../handlers/products';
import { eq } from 'drizzle-orm';

// Test data
const testCategory = {
  name: 'Electronics'
};

const testCategory2 = {
  name: 'Clothing'
};

const testProductInput: CreateProductInput = {
  name: 'Test Product',
  category_id: 1,
  original_price: 100.00,
  discount_percentage: 10,
  image_url: 'https://example.com/image.jpg'
};

const testProductInput2: CreateProductInput = {
  name: 'Another Product',
  category_id: 1,
  original_price: 50.00,
  discount_percentage: 0,
  image_url: null
};

describe('Products Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test categories
  const createTestCategories = async () => {
    const categories = await db.insert(productCategoriesTable)
      .values([testCategory, testCategory2])
      .returning()
      .execute();
    return categories;
  };

  describe('createProduct', () => {
    it('should create a product with all fields', async () => {
      await createTestCategories();

      const result = await createProduct(testProductInput);

      expect(result.name).toEqual('Test Product');
      expect(result.category_id).toEqual(1);
      expect(result.original_price).toEqual(100.00);
      expect(result.discount_percentage).toEqual(10);
      expect(result.price_after_discount).toEqual(90.00); // 100 - 10%
      expect(result.image_url).toEqual('https://example.com/image.jpg');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.product_id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should auto-generate product_id when not provided', async () => {
      await createTestCategories();

      const result = await createProduct(testProductInput);
      expect(result.product_id).toMatch(/P\d{3}/);
    });

    it('should use provided product_id', async () => {
      await createTestCategories();

      const inputWithId = { ...testProductInput, product_id: 'CUSTOM001' };
      const result = await createProduct(inputWithId);
      expect(result.product_id).toEqual('CUSTOM001');
    });

    it('should handle discount_percentage default correctly', async () => {
      await createTestCategories();

      // Test with explicit 0 discount_percentage
      const inputWithZeroDiscount: CreateProductInput = {
        name: testProductInput.name,
        category_id: testProductInput.category_id,
        original_price: testProductInput.original_price,
        discount_percentage: 0,
        image_url: testProductInput.image_url
      };

      const result = await createProduct(inputWithZeroDiscount);
      expect(result.discount_percentage).toEqual(0);
      expect(result.price_after_discount).toEqual(100.00);
    });

    it('should save product to database', async () => {
      await createTestCategories();

      const result = await createProduct(testProductInput);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, result.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Test Product');
      expect(parseFloat(products[0].original_price)).toEqual(100.00);
      expect(parseFloat(products[0].price_after_discount)).toEqual(90.00);
    });

    it('should throw error for non-existent category', async () => {
      await createTestCategories();

      const invalidInput = { ...testProductInput, category_id: 999 };
      
      await expect(createProduct(invalidInput)).rejects.toThrow(/Category with id 999 does not exist/i);
    });

    it('should calculate price_after_discount correctly for various discounts', async () => {
      await createTestCategories();

      // 25% discount
      const input25 = { ...testProductInput, discount_percentage: 25 };
      const result25 = await createProduct(input25);
      expect(result25.price_after_discount).toEqual(75.00);

      // 0% discount
      const input0 = { ...testProductInput, name: 'No Discount', discount_percentage: 0 };
      const result0 = await createProduct(input0);
      expect(result0.price_after_discount).toEqual(100.00);
    });
  });

  describe('getProducts', () => {
    it('should return empty array when no products exist', async () => {
      const results = await getProducts();
      expect(results).toEqual([]);
    });

    it('should return all products', async () => {
      await createTestCategories();
      await createProduct(testProductInput);
      await createProduct(testProductInput2);

      const results = await getProducts();

      expect(results).toHaveLength(2);
      expect(results[0].name).toEqual('Test Product');
      expect(results[1].name).toEqual('Another Product');
      
      // Check numeric conversion
      expect(typeof results[0].original_price).toBe('number');
      expect(typeof results[0].discount_percentage).toBe('number');
      expect(typeof results[0].price_after_discount).toBe('number');
    });

    it('should return both active and inactive products', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);
      await deleteProduct(product.id); // Soft delete

      const results = await getProducts();

      expect(results).toHaveLength(1);
      expect(results[0].is_active).toBe(false);
    });
  });

  describe('getActiveProducts', () => {
    it('should return only active products', async () => {
      await createTestCategories();
      const product1 = await createProduct(testProductInput);
      const product2 = await createProduct(testProductInput2);
      
      // Soft delete one product
      await deleteProduct(product1.id);

      const results = await getActiveProducts();

      expect(results).toHaveLength(1);
      expect(results[0].name).toEqual('Another Product');
      expect(results[0].is_active).toBe(true);
    });

    it('should return empty array when no active products exist', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);
      await deleteProduct(product.id);

      const results = await getActiveProducts();
      expect(results).toEqual([]);
    });
  });

  describe('getProductsByCategory', () => {
    it('should return products filtered by category', async () => {
      const categories = await createTestCategories();
      
      const product1 = { ...testProductInput, category_id: categories[0].id };
      const product2 = { ...testProductInput2, category_id: categories[1].id, name: 'Category 2 Product' };
      
      await createProduct(product1);
      await createProduct(product2);

      const results = await getProductsByCategory(categories[0].id);

      expect(results).toHaveLength(1);
      expect(results[0].name).toEqual('Test Product');
      expect(results[0].category_id).toEqual(categories[0].id);
    });

    it('should return only active products in category', async () => {
      const categories = await createTestCategories();
      
      const product1 = { ...testProductInput, category_id: categories[0].id };
      const product2 = { ...testProductInput2, category_id: categories[0].id };
      
      const createdProduct1 = await createProduct(product1);
      await createProduct(product2);
      
      // Soft delete one product
      await deleteProduct(createdProduct1.id);

      const results = await getProductsByCategory(categories[0].id);

      expect(results).toHaveLength(1);
      expect(results[0].name).toEqual('Another Product');
    });

    it('should throw error for non-existent category', async () => {
      await expect(getProductsByCategory(999)).rejects.toThrow(/Category with id 999 does not exist/i);
    });

    it('should return empty array for category with no products', async () => {
      const categories = await createTestCategories();
      
      const results = await getProductsByCategory(categories[1].id);
      expect(results).toEqual([]);
    });
  });

  describe('getProductById', () => {
    it('should return product by ID', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);

      const result = await getProductById(product.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(product.id);
      expect(result!.name).toEqual('Test Product');
      expect(typeof result!.original_price).toBe('number');
    });

    it('should return null for non-existent product', async () => {
      const result = await getProductById(999);
      expect(result).toBeNull();
    });

    it('should return inactive products', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);
      await deleteProduct(product.id);

      const result = await getProductById(product.id);

      expect(result).not.toBeNull();
      expect(result!.is_active).toBe(false);
    });
  });

  describe('updateProduct', () => {
    it('should update product fields', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);

      const updateInput: UpdateProductInput = {
        id: product.id,
        name: 'Updated Product Name',
        original_price: 150.00,
        discount_percentage: 20
      };

      const result = await updateProduct(updateInput);

      expect(result.name).toEqual('Updated Product Name');
      expect(result.original_price).toEqual(150.00);
      expect(result.discount_percentage).toEqual(20);
      expect(result.price_after_discount).toEqual(120.00); // 150 - 20%
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should recalculate price_after_discount when price changes', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);

      const updateInput: UpdateProductInput = {
        id: product.id,
        original_price: 200.00
      };

      const result = await updateProduct(updateInput);

      expect(result.original_price).toEqual(200.00);
      expect(result.discount_percentage).toEqual(10); // Unchanged
      expect(result.price_after_discount).toEqual(180.00); // 200 - 10%
    });

    it('should recalculate price_after_discount when discount changes', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);

      const updateInput: UpdateProductInput = {
        id: product.id,
        discount_percentage: 25
      };

      const result = await updateProduct(updateInput);

      expect(result.original_price).toEqual(100.00); // Unchanged
      expect(result.discount_percentage).toEqual(25);
      expect(result.price_after_discount).toEqual(75.00); // 100 - 25%
    });

    it('should update category_id when valid', async () => {
      const categories = await createTestCategories();
      const product = await createProduct({ ...testProductInput, category_id: categories[0].id });

      const updateInput: UpdateProductInput = {
        id: product.id,
        category_id: categories[1].id
      };

      const result = await updateProduct(updateInput);
      expect(result.category_id).toEqual(categories[1].id);
    });

    it('should throw error for non-existent product', async () => {
      const updateInput: UpdateProductInput = {
        id: 999,
        name: 'Non-existent'
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/Product with id 999 does not exist/i);
    });

    it('should throw error for non-existent category', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);

      const updateInput: UpdateProductInput = {
        id: product.id,
        category_id: 999
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/Category with id 999 does not exist/i);
    });

    it('should persist changes to database', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);

      const updateInput: UpdateProductInput = {
        id: product.id,
        name: 'Database Test Product'
      };

      await updateProduct(updateInput);

      const dbProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .execute();

      expect(dbProduct[0].name).toEqual('Database Test Product');
    });
  });

  describe('deleteProduct', () => {
    it('should soft delete product by setting is_active to false', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);

      const result = await deleteProduct(product.id);

      expect(result.success).toBe(true);

      // Verify product is soft deleted
      const deletedProduct = await getProductById(product.id);
      expect(deletedProduct).not.toBeNull();
      expect(deletedProduct!.is_active).toBe(false);
    });

    it('should throw error for non-existent product', async () => {
      await expect(deleteProduct(999)).rejects.toThrow(/Product with id 999 does not exist/i);
    });

    it('should persist deletion to database', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);

      await deleteProduct(product.id);

      const dbProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .execute();

      expect(dbProduct[0].is_active).toBe(false);
    });

    it('should update updated_at timestamp on deletion', async () => {
      await createTestCategories();
      const product = await createProduct(testProductInput);
      const originalUpdatedAt = product.updated_at;

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await deleteProduct(product.id);

      const deletedProduct = await getProductById(product.id);
      expect(deletedProduct!.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('product_id auto-generation', () => {
    it('should generate sequential product IDs', async () => {
      await createTestCategories();

      const product1 = await createProduct(testProductInput);
      const product2 = await createProduct({ ...testProductInput2, name: 'Second Product' });

      expect(product1.product_id).toMatch(/P\d{3}/);
      expect(product2.product_id).toMatch(/P\d{3}/);
      
      // Extract numbers and verify they're sequential
      const id1Num = parseInt(product1.product_id.substring(1));
      const id2Num = parseInt(product2.product_id.substring(1));
      expect(id2Num).toEqual(id1Num + 1);
    });

    it('should start with P001 for first product', async () => {
      await createTestCategories();

      const product = await createProduct(testProductInput);
      expect(product.product_id).toEqual('P001');
    });
  });
});