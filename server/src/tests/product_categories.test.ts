import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productCategoriesTable, productsTable } from '../db/schema';
import { type CreateProductCategoryInput, type UpdateProductCategoryInput } from '../schema';
import { createProductCategory, getProductCategories, updateProductCategory, deleteProductCategory } from '../handlers/product_categories';
import { eq } from 'drizzle-orm';

// Test input data
const testCategoryInput: CreateProductCategoryInput = {
  name: 'Test Category'
};

const testUpdateInput: UpdateProductCategoryInput = {
  id: 1,
  name: 'Updated Category'
};

describe('Product Categories Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createProductCategory', () => {
    it('should create a product category', async () => {
      const result = await createProductCategory(testCategoryInput);

      expect(result.name).toEqual('Test Category');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save category to database', async () => {
      const result = await createProductCategory(testCategoryInput);

      const categories = await db.select()
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Test Category');
      expect(categories[0].created_at).toBeInstanceOf(Date);
      expect(categories[0].updated_at).toBeInstanceOf(Date);
    });

    it('should handle duplicate category names', async () => {
      await createProductCategory(testCategoryInput);
      
      await expect(createProductCategory(testCategoryInput))
        .rejects.toThrow();
    });
  });

  describe('getProductCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const categories = await getProductCategories();
      expect(categories).toHaveLength(0);
    });

    it('should fetch all categories ordered by name', async () => {
      // Create multiple categories
      await createProductCategory({ name: 'Zebra Category' });
      await createProductCategory({ name: 'Alpha Category' });
      await createProductCategory({ name: 'Beta Category' });

      const categories = await getProductCategories();

      expect(categories).toHaveLength(3);
      expect(categories[0].name).toEqual('Alpha Category');
      expect(categories[1].name).toEqual('Beta Category');
      expect(categories[2].name).toEqual('Zebra Category');
    });

    it('should return categories with all required fields', async () => {
      await createProductCategory(testCategoryInput);

      const categories = await getProductCategories();

      expect(categories).toHaveLength(1);
      const category = categories[0];
      expect(category.id).toBeDefined();
      expect(category.name).toEqual('Test Category');
      expect(category.created_at).toBeInstanceOf(Date);
      expect(category.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateProductCategory', () => {
    it('should update category name', async () => {
      const created = await createProductCategory(testCategoryInput);
      
      const result = await updateProductCategory({
        id: created.id,
        name: 'Updated Category'
      });

      expect(result.name).toEqual('Updated Category');
      expect(result.id).toEqual(created.id);
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should update category in database', async () => {
      const created = await createProductCategory(testCategoryInput);
      
      await updateProductCategory({
        id: created.id,
        name: 'Updated Category'
      });

      const categories = await db.select()
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.id, created.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Updated Category');
    });

    it('should handle partial updates', async () => {
      const created = await createProductCategory(testCategoryInput);
      const originalName = created.name;
      
      const result = await updateProductCategory({
        id: created.id
        // No name provided - should keep original
      });

      expect(result.name).toEqual(originalName);
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should throw error for non-existent category', async () => {
      await expect(updateProductCategory({
        id: 999,
        name: 'Updated Category'
      })).rejects.toThrow(/not found/i);
    });

    it('should handle duplicate names', async () => {
      await createProductCategory({ name: 'Category 1' });
      const category2 = await createProductCategory({ name: 'Category 2' });

      await expect(updateProductCategory({
        id: category2.id,
        name: 'Category 1'
      })).rejects.toThrow();
    });
  });

  describe('deleteProductCategory', () => {
    it('should delete category successfully', async () => {
      const created = await createProductCategory(testCategoryInput);
      
      const result = await deleteProductCategory(created.id);
      expect(result.success).toBe(true);

      // Verify deletion
      const categories = await db.select()
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.id, created.id))
        .execute();

      expect(categories).toHaveLength(0);
    });

    it('should throw error for non-existent category', async () => {
      await expect(deleteProductCategory(999))
        .rejects.toThrow(/not found/i);
    });

    it('should prevent deletion when category has products', async () => {
      const category = await createProductCategory(testCategoryInput);
      
      // Create a product with this category
      await db.insert(productsTable)
        .values({
          product_id: 'TEST001',
          name: 'Test Product',
          category_id: category.id,
          original_price: '99.99',
          discount_percentage: '0',
          price_after_discount: '99.99'
        })
        .execute();

      await expect(deleteProductCategory(category.id))
        .rejects.toThrow(/being used by products/i);
    });

    it('should allow deletion when category has no products', async () => {
      const category1 = await createProductCategory({ name: 'Category 1' });
      const category2 = await createProductCategory({ name: 'Category 2' });
      
      // Create a product with category2, not category1
      await db.insert(productsTable)
        .values({
          product_id: 'TEST001',
          name: 'Test Product',
          category_id: category2.id,
          original_price: '99.99',
          discount_percentage: '0',
          price_after_discount: '99.99'
        })
        .execute();

      // Should be able to delete category1 since it has no products
      const result = await deleteProductCategory(category1.id);
      expect(result.success).toBe(true);

      // Verify category1 is deleted
      const categories = await db.select()
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.id, category1.id))
        .execute();

      expect(categories).toHaveLength(0);
    });
  });
});