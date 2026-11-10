import { readFileSync } from 'node:fs';
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;
const DEV_EMAIL = 'lindsayprachi@gmail.com';

describe('RADIANCE Bangladesh Hardened Firestore Rules — Developer-Only Catalog & Dirty Dozen Suite', () => {
  before(async () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: 'radiance-security-test',
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      const now = Timestamp.now();
      await setDoc(doc(adminDb, 'users', 'user_dev'), {
        uid: 'user_dev',
        displayName: 'Store Developer',
        colorTone: 'warm',
        preferredFit: 'tailored',
        heightCm: 165,
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(adminDb, 'users', 'user_alice'), {
        uid: 'user_alice',
        displayName: 'Nadia Rahman',
        colorTone: 'warm',
        preferredFit: 'tailored',
        heightCm: 164,
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(doc(adminDb, 'catalogItems', 'private_item_1'), {
        ownerId: 'user_dev',
        name: 'Private Archive Handloom Kurti',
        category: 'Kurtis',
        colorTone: 'warm',
        colorName: 'Botanical Olive',
        priceCents: 385000,
        fabric: 'Tangail Handloom Cotton',
        description: 'Archive sample.',
        imageDataUrl: '',
        visibility: 'private',
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(
        doc(adminDb, 'users', 'user_alice', 'wishlist', 'bd_kurti_olive_01'),
        {
          userId: 'user_alice',
          garmentId: 'bd_kurti_olive_01',
          garmentName: 'Zayna Handloom Kantha-Placket Kurti',
          category: 'Kurtis',
          colorTone: 'warm',
          colorName: 'Botanical Olive & Ecru',
          priceCents: 385000,
          createdAt: now,
        }
      );
      await setDoc(doc(adminDb, 'users', 'user_alice', 'orders', 'order_101'), {
        userId: 'user_alice',
        orderNumber: 'RAD-1010',
        itemCount: 1,
        itemsSummary: 'Zayna Olive Kurti (M)',
        subtotalCents: 385000,
        shippingCents: 12000,
        totalCents: 397000,
        paymentMethod: 'cod',
        paymentRef: 'ver_cod_COD0_99887766',
        recipientName: 'Nadia Rahman',
        shippingAddress: 'Road 11, Banani, Dhaka',
        postalCode: '1213',
        phone: '+8801711000000',
        status: 'confirmed',
        createdAt: now,
      });
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('1. Rejects Shadow Field injection on UserStyleProfile create', async () => {
    const bobDb = testEnv
      .authenticatedContext('user_bob', { email_verified: true })
      .firestore();
    await assertFails(
      setDoc(doc(bobDb, 'users', 'user_bob'), {
        uid: 'user_bob',
        displayName: 'Bob',
        colorTone: 'warm',
        preferredFit: 'tailored',
        heightCm: 174,
        isAdmin: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('2. Rejects Developer Email Spoof Attack when email_verified is false', async () => {
    const spoofedDevDb = testEnv
      .authenticatedContext('user_dev', {
        email: DEV_EMAIL,
        email_verified: false,
      })
      .firestore();
    await assertFails(
      setDoc(doc(spoofedDevDb, 'catalogItems', 'spoof_dev_item'), {
        ownerId: 'user_dev',
        name: 'Jamdani Kurti',
        category: 'Kurtis',
        colorTone: 'warm',
        colorName: 'Terracotta',
        priceCents: 350000,
        fabric: 'Jamdani Cotton',
        description: 'Spoof attempt.',
        imageDataUrl: '',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('3. Rejects regular shoppers from creating/updating/deleting CatalogItems and rejects disallowed categories', async () => {
    const aliceDb = testEnv
      .authenticatedContext('user_alice', {
        email: 'alice@example.com',
        email_verified: true,
      })
      .firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'catalogItems', 'shopper_item'), {
        ownerId: 'user_alice',
        name: 'Olive Kurti',
        category: 'Kurtis',
        colorTone: 'warm',
        colorName: 'Olive',
        priceCents: 320000,
        fabric: '100% Handloom Cotton',
        description: 'Tailored kurti.',
        imageDataUrl: '',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(aliceDb, 'catalogItems', 'private_item_1')));

    const devDb = testEnv
      .authenticatedContext('user_dev', {
        email: DEV_EMAIL,
        email_verified: true,
      })
      .firestore();
    await assertFails(
      setDoc(doc(devDb, 'catalogItems', 'disallowed_sari'), {
        ownerId: 'user_dev',
        name: 'Silk Sari',
        category: 'Saris',
        colorTone: 'warm',
        colorName: 'Olive',
        priceCents: 450000,
        fabric: 'Silk',
        description: 'Disallowed category.',
        imageDataUrl: '',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('4. Rejects Update-Gap value poisoning (priceCents outside ৳1,000–৳5,000) on CatalogItem update', async () => {
    const devDb = testEnv
      .authenticatedContext('user_dev', {
        email: DEV_EMAIL,
        email_verified: true,
      })
      .firestore();
    await assertFails(
      updateDoc(doc(devDb, 'catalogItems', 'private_item_1'), {
        priceCents: 50000,
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(devDb, 'catalogItems', 'private_item_1'), {
        priceCents: 600000,
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('5. Rejects immortal field mutation (createdAt) on UserStyleProfile update', async () => {
    const aliceDb = testEnv
      .authenticatedContext('user_alice', { email_verified: true })
      .firestore();
    await assertFails(
      updateDoc(doc(aliceDb, 'users', 'user_alice'), {
        colorTone: 'cool',
        createdAt: Timestamp.fromMillis(1577836800000),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('6. Rejects forged client timestamp on CatalogItem create', async () => {
    const devDb = testEnv
      .authenticatedContext('user_dev', {
        email: DEV_EMAIL,
        email_verified: true,
      })
      .firestore();
    await assertFails(
      setDoc(doc(devDb, 'catalogItems', 'forged_time_item'), {
        ownerId: 'user_dev',
        name: 'Moss Trousers',
        category: 'Trousers',
        colorTone: 'cool',
        colorName: 'Moss Olive',
        priceCents: 295000,
        fabric: 'Cotton Twill',
        description: 'Structured wide-leg trousers.',
        imageDataUrl: '',
        visibility: 'public',
        createdAt: Timestamp.fromMillis(1600000000000),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('7. Rejects orphaned WishlistItem writes when parent user profile does not exist', async () => {
    const ghostDb = testEnv
      .authenticatedContext('user_ghost', { email_verified: true })
      .firestore();
    await assertFails(
      setDoc(doc(ghostDb, 'users', 'user_ghost', 'wishlist', 'bd_kurti_olive_01'), {
        userId: 'user_ghost',
        garmentId: 'bd_kurti_olive_01',
        garmentName: 'Zayna Handloom Kantha-Placket Kurti',
        category: 'Kurtis',
        colorTone: 'warm',
        colorName: 'Botanical Olive',
        priceCents: 385000,
        createdAt: serverTimestamp(),
      })
    );
  });

  it('8. Rejects cross-user reads on another shopper OrderRecord or WishlistItem', async () => {
    const malloryDb = testEnv
      .authenticatedContext('user_mallory', { email_verified: true })
      .firestore();
    await assertFails(
      getDoc(doc(malloryDb, 'users', 'user_alice', 'orders', 'order_101'))
    );
    await assertFails(
      getDoc(doc(malloryDb, 'users', 'user_alice', 'wishlist', 'bd_kurti_olive_01'))
    );
  });

  it('9. Rejects unfiltered blanket list scrape on catalogItems containing private docs', async () => {
    const malloryDb = testEnv
      .authenticatedContext('user_mallory', { email_verified: true })
      .firestore();
    await assertFails(getDocs(collection(malloryDb, 'catalogItems')));
  });

  it('10. Rejects OrderRecord create when totalCents != subtotalCents + shippingCents', async () => {
    const aliceDb = testEnv
      .authenticatedContext('user_alice', { email_verified: true })
      .firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'users', 'user_alice', 'orders', 'order_tampered'), {
        userId: 'user_alice',
        orderNumber: 'RAD-1001',
        itemCount: 1,
        itemsSummary: 'Zayna Olive Kurti (M) x1',
        subtotalCents: 385000,
        shippingCents: 12000,
        totalCents: 100,
        paymentMethod: 'cod',
        paymentRef: 'ver_abc12345',
        recipientName: 'Nadia Rahman',
        shippingAddress: 'Road 11, Banani, Dhaka',
        postalCode: '1213',
        phone: '+8801711000000',
        status: 'confirmed',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('11. Rejects WishlistItem path-field mismatch and post-creation updates', async () => {
    const aliceDb = testEnv
      .authenticatedContext('user_alice', { email_verified: true })
      .firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'users', 'user_alice', 'wishlist', 'bd_westtop_ivory_02'), {
        userId: 'user_alice',
        garmentId: 'mismatched_other_id',
        garmentName: 'Aranya Wrap Top',
        category: 'Western Tops',
        colorTone: 'cool',
        colorName: 'Chalk Off-White',
        priceCents: 265000,
        createdAt: serverTimestamp(),
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, 'users', 'user_alice', 'wishlist', 'bd_kurti_olive_01'), {
        priceCents: 100,
      })
    );
  });

  it('12. Rejects poisoned document IDs and oversized imageDataUrl resource exhaustion', async () => {
    const devDb = testEnv
      .authenticatedContext('user_dev', {
        email: DEV_EMAIL,
        email_verified: true,
      })
      .firestore();
    await assertFails(
      setDoc(doc(devDb, 'catalogItems', 'bad$id!spaces'), {
        ownerId: 'user_dev',
        name: 'Cotton Top',
        category: 'Western Tops',
        colorTone: 'warm',
        colorName: 'Off-White',
        priceCents: 220000,
        fabric: 'Cotton',
        description: 'Clean top.',
        imageDataUrl: '',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      setDoc(doc(devDb, 'catalogItems', 'oversized_item'), {
        ownerId: 'user_dev',
        name: 'Cotton Top',
        category: 'Western Tops',
        colorTone: 'warm',
        colorName: 'Off-White',
        priceCents: 220000,
        fabric: 'Cotton',
        description: 'Clean top.',
        imageDataUrl: 'a'.repeat(350001),
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Allows verified developer (lindsayprachi@gmail.com) to add new outfit piece to catalogItems', async () => {
    const devDb = testEnv
      .authenticatedContext('user_dev', {
        email: DEV_EMAIL,
        email_verified: true,
      })
      .firestore();
    await assertSucceeds(
      setDoc(doc(devDb, 'catalogItems', 'dev_jamdani_kurti_01'), {
        ownerId: 'user_dev',
        name: 'Sonargaon Terracotta Jamdani Kurti',
        category: 'Kurtis',
        colorTone: 'warm',
        colorName: 'Terracotta Coral',
        priceCents: 420000,
        fabric: 'Sonargaon Jamdani Cotton',
        description: 'Handwoven Jamdani motif kurti.',
        imageDataUrl: '',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Enforces developer-only writes and strict starter-ID allowlist on /storefrontConfig/main', async () => {
    const aliceDb = testEnv
      .authenticatedContext('user_alice', {
        email: 'alice@example.com',
        email_verified: true,
      })
      .firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'storefrontConfig', 'main'), {
        updatedBy: 'user_alice',
        heroImageDataUrl: 'data:image/jpeg;base64,abc',
        deletedStarterIds: ['bd_kurti_jamdani_01'],
        updatedAt: serverTimestamp(),
      })
    );

    const devDb = testEnv
      .authenticatedContext('user_dev', {
        email: DEV_EMAIL,
        email_verified: true,
      })
      .firestore();
    await assertFails(
      setDoc(doc(devDb, 'storefrontConfig', 'rogue_doc'), {
        updatedBy: 'user_dev',
        heroImageDataUrl: '',
        deletedStarterIds: [],
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      setDoc(doc(devDb, 'storefrontConfig', 'main'), {
        updatedBy: 'user_dev',
        heroImageDataUrl: '',
        deletedStarterIds: ['invalid_starter_id'],
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      setDoc(doc(devDb, 'storefrontConfig', 'main'), {
        updatedBy: 'user_dev',
        heroImageDataUrl: 'data:image/jpeg;base64,customhome',
        deletedStarterIds: ['bd_kurti_jamdani_01'],
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(getDoc(doc(aliceDb, 'storefrontConfig', 'main')));
  });
});
