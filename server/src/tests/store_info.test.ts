import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { storeInfoTable } from '../db/schema';
import { type CreateStoreInfoInput, type UpdateStoreInfoInput } from '../schema';
import { createStoreInfo, getStoreInfo, updateStoreInfo } from '../handlers/store_info';
import { eq } from 'drizzle-orm';

// Test input data
const testStoreInput: CreateStoreInfoInput = {
  store_name: 'Test Store',
  ssm_no: 'SSM123456789',
  address: '123 Test Street, Test City',
  phone_no: '+60123456789',
  logo_url: 'https://example.com/logo.png'
};

const minimalStoreInput: CreateStoreInfoInput = {
  store_name: 'Minimal Store',
  ssm_no: null,
  address: null,
  phone_no: null,
  logo_url: null
};

describe('Store Info Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createStoreInfo', () => {
    it('should create store info with all fields', async () => {
      const result = await createStoreInfo(testStoreInput);

      expect(result.store_name).toEqual('Test Store');
      expect(result.ssm_no).toEqual('SSM123456789');
      expect(result.address).toEqual('123 Test Street, Test City');
      expect(result.phone_no).toEqual('+60123456789');
      expect(result.logo_url).toEqual('https://example.com/logo.png');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create store info with minimal fields', async () => {
      const result = await createStoreInfo(minimalStoreInput);

      expect(result.store_name).toEqual('Minimal Store');
      expect(result.ssm_no).toBeNull();
      expect(result.address).toBeNull();
      expect(result.phone_no).toBeNull();
      expect(result.logo_url).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save store info to database', async () => {
      const result = await createStoreInfo(testStoreInput);

      // Query database directly to verify
      const storeFromDB = await db.select()
        .from(storeInfoTable)
        .where(eq(storeInfoTable.id, result.id))
        .execute();

      expect(storeFromDB).toHaveLength(1);
      expect(storeFromDB[0].store_name).toEqual('Test Store');
      expect(storeFromDB[0].ssm_no).toEqual('SSM123456789');
      expect(storeFromDB[0].address).toEqual('123 Test Street, Test City');
      expect(storeFromDB[0].phone_no).toEqual('+60123456789');
      expect(storeFromDB[0].logo_url).toEqual('https://example.com/logo.png');
      expect(storeFromDB[0].created_at).toBeInstanceOf(Date);
      expect(storeFromDB[0].updated_at).toBeInstanceOf(Date);
    });
  });

  describe('getStoreInfo', () => {
    it('should return null when no store info exists', async () => {
      const result = await getStoreInfo();
      expect(result).toBeNull();
    });

    it('should return store info when it exists', async () => {
      // Create store info first
      const created = await createStoreInfo(testStoreInput);

      const result = await getStoreInfo();

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.store_name).toEqual('Test Store');
      expect(result!.ssm_no).toEqual('SSM123456789');
      expect(result!.address).toEqual('123 Test Street, Test City');
      expect(result!.phone_no).toEqual('+60123456789');
      expect(result!.logo_url).toEqual('https://example.com/logo.png');
    });

    it('should return first store info when multiple exist', async () => {
      // Create first store
      await createStoreInfo(testStoreInput);
      
      // Create second store directly in DB
      await db.insert(storeInfoTable)
        .values({
          store_name: 'Second Store',
          ssm_no: null,
          address: null,
          phone_no: null,
          logo_url: null
        })
        .execute();

      const result = await getStoreInfo();

      expect(result).not.toBeNull();
      expect(result!.store_name).toEqual('Test Store'); // Should return first one
    });
  });

  describe('updateStoreInfo', () => {
    let existingStore: any;

    beforeEach(async () => {
      existingStore = await createStoreInfo(testStoreInput);
    });

    it('should update all fields', async () => {
      const updateInput: UpdateStoreInfoInput = {
        id: existingStore.id,
        store_name: 'Updated Store Name',
        ssm_no: 'NEW123456789',
        address: '456 New Address',
        phone_no: '+60987654321',
        logo_url: 'https://example.com/new-logo.png'
      };

      const result = await updateStoreInfo(updateInput);

      expect(result.id).toEqual(existingStore.id);
      expect(result.store_name).toEqual('Updated Store Name');
      expect(result.ssm_no).toEqual('NEW123456789');
      expect(result.address).toEqual('456 New Address');
      expect(result.phone_no).toEqual('+60987654321');
      expect(result.logo_url).toEqual('https://example.com/new-logo.png');
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should update only provided fields', async () => {
      const updateInput: UpdateStoreInfoInput = {
        id: existingStore.id,
        store_name: 'Partially Updated Store',
        phone_no: '+60111111111'
      };

      const result = await updateStoreInfo(updateInput);

      expect(result.store_name).toEqual('Partially Updated Store');
      expect(result.phone_no).toEqual('+60111111111');
      // Other fields should remain unchanged
      expect(result.ssm_no).toEqual('SSM123456789');
      expect(result.address).toEqual('123 Test Street, Test City');
      expect(result.logo_url).toEqual('https://example.com/logo.png');
    });

    it('should update fields to null', async () => {
      const updateInput: UpdateStoreInfoInput = {
        id: existingStore.id,
        ssm_no: null,
        address: null,
        logo_url: null
      };

      const result = await updateStoreInfo(updateInput);

      expect(result.ssm_no).toBeNull();
      expect(result.address).toBeNull();
      expect(result.logo_url).toBeNull();
      // Unchanged fields
      expect(result.store_name).toEqual('Test Store');
      expect(result.phone_no).toEqual('+60123456789');
    });

    it('should save updated data to database', async () => {
      const updateInput: UpdateStoreInfoInput = {
        id: existingStore.id,
        store_name: 'Database Updated Store'
      };

      await updateStoreInfo(updateInput);

      // Query database directly to verify
      const storeFromDB = await db.select()
        .from(storeInfoTable)
        .where(eq(storeInfoTable.id, existingStore.id))
        .execute();

      expect(storeFromDB).toHaveLength(1);
      expect(storeFromDB[0].store_name).toEqual('Database Updated Store');
    });

    it('should throw error when store does not exist', async () => {
      const updateInput: UpdateStoreInfoInput = {
        id: 99999, // Non-existent ID
        store_name: 'Non-existent Store'
      };

      await expect(updateStoreInfo(updateInput)).rejects.toThrow(/Store information not found/i);
    });

    it('should update timestamp when any field is updated', async () => {
      const originalUpdatedAt = existingStore.updated_at;

      // Wait a small amount to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateInput: UpdateStoreInfoInput = {
        id: existingStore.id,
        store_name: 'Timestamp Test Store'
      };

      const result = await updateStoreInfo(updateInput);

      expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});