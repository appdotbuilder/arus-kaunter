import { db } from '../db';
import { storeInfoTable } from '../db/schema';
import { type CreateStoreInfoInput, type UpdateStoreInfoInput, type StoreInfo } from '../schema';
import { eq } from 'drizzle-orm';

export async function createStoreInfo(input: CreateStoreInfoInput): Promise<StoreInfo> {
  try {
    // Insert store information record
    const result = await db.insert(storeInfoTable)
      .values({
        store_name: input.store_name,
        ssm_no: input.ssm_no,
        address: input.address,
        phone_no: input.phone_no,
        logo_url: input.logo_url
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Store info creation failed:', error);
    throw error;
  }
}

export async function getStoreInfo(): Promise<StoreInfo | null> {
  try {
    // Get the first (and should be only) store info record
    const result = await db.select()
      .from(storeInfoTable)
      .limit(1)
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Store info retrieval failed:', error);
    throw error;
  }
}

export async function updateStoreInfo(input: UpdateStoreInfoInput): Promise<StoreInfo> {
  try {
    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (input.store_name !== undefined) {
      updateData['store_name'] = input.store_name;
    }
    if (input.ssm_no !== undefined) {
      updateData['ssm_no'] = input.ssm_no;
    }
    if (input.address !== undefined) {
      updateData['address'] = input.address;
    }
    if (input.phone_no !== undefined) {
      updateData['phone_no'] = input.phone_no;
    }
    if (input.logo_url !== undefined) {
      updateData['logo_url'] = input.logo_url;
    }

    // Update the store information record
    const result = await db.update(storeInfoTable)
      .set(updateData)
      .where(eq(storeInfoTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Store information not found');
    }

    return result[0];
  } catch (error) {
    console.error('Store info update failed:', error);
    throw error;
  }
}