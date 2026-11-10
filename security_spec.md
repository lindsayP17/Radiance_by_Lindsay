# RADIANCE Bangladesh Firestore Security Specification

## 1. Data Invariants

1. **Default-Deny Catch-All**: Any path not explicitly matched under `/users/{userId}`, `/catalogItems/{itemId}`, `/storefrontConfig/{configId}`, `/users/{userId}/savedLooks/{lookId}`, `/users/{userId}/wishlist/{garmentId}`, or `/users/{userId}/orders/{orderId}` is unconditionally denied (`allow read, write: if false`).
2. **Verified Identity & Developer-Only Catalog/Storefront RBAC**: Every standard user write operation (`create`, `update`, `delete`) requires `request.auth != null && request.auth.token.email_verified == true`. All write operations (`create`, `update`, `delete`) and private reads on `/catalogItems/{itemId}`, as well as all writes (`create`, `update`) on `/storefrontConfig/main`, are strictly restricted to the verified store developer (`request.auth.token.email_verified == true && request.auth.token.email == 'lindsayprachi@gmail.com'`). Regular shoppers can only read `visibility == 'public'` catalog items and perform `get` on `/storefrontConfig/main`.
3. **Path Variable Hardening & Singleton Lock**: Every single-document target (`get`, `create`, `update`, `delete`) enforces `isValidId(id)` (`size <= 128` and regex `^[a-zA-Z0-9_\-]+$`). `/storefrontConfig/{configId}` additionally restricts `configId == 'main'` and forbids `list` and `delete`.
4. **Master Gate Relational Sync**: Subcollections `/users/{userId}/savedLooks/{lookId}`, `/users/{userId}/wishlist/{garmentId}`, and `/users/{userId}/orders/{orderId}` cannot be created, fetched individually, or deleted unless the parent `/users/{userId}` document exists and its `uid` matches `request.auth.uid`. Likewise, `/catalogItems/{itemId}` and `/storefrontConfig/main` writes require the developer's parent `/users/{uid}` document to exist.
5. **Curated Bangladeshi Category & Starter-ID Array Guard**: `CatalogItem` and `WishlistItem` strictly enforce `category in ['Western Tops', 'Traditional Tops', 'Kurtis', 'Long Skirts', 'Trousers', 'Scarves']` (`minLength: 6`, `maxLength: 20`), rejecting unsupported categories such as `'Saris'` or `'Shalwar Kameez'`. `StorefrontConfig.deletedStarterIds` enforces `size() <= 6` and `.hasOnly(['bd_kurti_jamdani_01', 'bd_tradtop_silk_02', 'bd_westtop_linen_03', 'bd_skirt_cotton_04', 'bd_trouser_linen_05', 'bd_scarf_muslin_06'])`.
6. **Deterministic Bookmark Key Integrity**: A `WishlistItem` at `/users/{userId}/wishlist/{garmentId}` must have `incoming().garmentId == garmentId`, `incoming().userId == request.auth.uid`, and is immutable after creation (`allow update: if false;`, only `create` and `delete` permitted).
7. **PII Isolation**: Shipping PII (`recipientName`, `shippingAddress`, `postalCode`, `phone`) exists exclusively in `/users/{userId}/orders/{orderId}`, readable strictly by `isOwner(userId)` where `resource.data.userId == request.auth.uid`. `/users/{userId}` stores zero PII and is also restricted strictly to `isOwner(userId)`.
8. **Temporal & Immutable Integrity**: All `createdAt` and `updatedAt` fields must equal server `request.time` on creation/modification; `createdAt`, `uid`, `userId`, and `ownerId` are strictly immutable across updates.
9. **BDT Poisha Financial & Terminal State Integrity**: `CatalogItem` and `WishlistItem` enforce `priceCents >= 100000 && priceCents <= 500000` (৳1,000 to ৳5,000 BDT). `OrderRecord` documents enforce `subtotalCents >= 100000 && subtotalCents <= 25000000`, must start in `status == 'confirmed'`, satisfy `totalCents == subtotalCents + shippingCents`, and are strictly immutable (`allow update, delete: if false`) once recorded.
10. **Query Enforcer (Zero Client Trust)**: Every `allow list` rule explicitly evaluates `resource.data` (`resource.data.userId == request.auth.uid` or `resource.data.visibility == 'public'`) without calling `get()` or `exists()`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below MUST evaluate to `PERMISSION_DENIED`:

1. **Payload 1 — Shadow Field Injection on `UserStyleProfile` Create**:
   Includes unauthorized `isAdmin: true` ghost key.
2. **Payload 2 — Developer Email Spoof Attack (`email_verified: false`) on `CatalogItem` or `StorefrontConfig` Write**:
   Auth context `{ uid: "user_dev", email: "lindsayprachi@gmail.com", email_verified: false }` attempting to add a garment to `/catalogItems` or modify `/storefrontConfig/main`.
3. **Payload 3 — Non-Developer Shopper Privilege Escalation on `CatalogItem` / `StorefrontConfig` & Disallowed Category (`Saris`)**:
   Verified regular shopper `{ uid: "user_alice", email: "alice@example.com", email_verified: true }` attempting to create `/catalogItems/shopper_item` or overwrite `/storefrontConfig/main`, or developer attempting category `"Saris"`.
4. **Payload 4 — Update-Gap Value Poisoning on `CatalogItem` Update (Out-of-Bounds BDT Price) & Invalid `deletedStarterIds` on `StorefrontConfig`**:
   Developer updates `priceCents` outside `100000..500000` or injects an arbitrary ID into `deletedStarterIds` on `/storefrontConfig/main`.
5. **Payload 5 — Immortal Field Tampering (`createdAt` Mutation) on `UserStyleProfile` Update**:
   Owner attempts to mutate `createdAt`.
6. **Payload 6 — Forged Client Timestamp (`createdAt != request.time`) on `CatalogItem` Create**:
   Developer submits backdated client timestamp instead of `serverTimestamp()`.
7. **Payload 7 — Orphaned Subcollection Write on `WishlistItem` Without Parent User Profile**:
   Authenticated user `"user_ghost"` writes `/users/user_ghost/wishlist/bd_kurti_olive_01` when `/users/user_ghost` does not exist.
8. **Payload 8 — Cross-User PII & Wishlist Leak (`get` on Another User's `OrderRecord` or `WishlistItem`)**:
   Authenticated user `"user_mallory"` attempts `getDoc` on `/users/user_alice/orders/order_101` or `/users/user_alice/wishlist/bd_kurti_olive_01`.
9. **Payload 9 — Unfiltered Blanket List Scrape on `/catalogItems` or `/storefrontConfig`**:
   Non-developer client executes `getDocs(collection(db, "catalogItems"))` without `where("visibility", "==", "public")` or attempts `getDocs(collection(db, "storefrontConfig"))`.
10. **Payload 10 — Arithmetic Total Manipulation on `OrderRecord` Create**:
    Buyer submits `totalCents != subtotalCents + shippingCents`.
11. **Payload 11 — Wishlist Path-Field Mismatch & Mutation Attack**:
    User creates `/users/user_alice/wishlist/bd_westtop_ivory_02` with mismatched payload `garmentId: "other_item"` or attempts `updateDoc` on an existing wishlist bookmark.
12. **Payload 12 — Path ID Poisoning, Non-Singleton Config Path & Resource Exhaustion**:
    Developer attempts to create `/catalogItems/bad$id!with spaces`, write `/storefrontConfig/rogue_doc`, or inject a `350,001`-byte `imageDataUrl` / `heroImageDataUrl` payload.
