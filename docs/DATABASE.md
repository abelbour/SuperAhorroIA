# Database Layer (LocalStorage)

## Implementation

**File**: `src/db.ts`  
**Class**: `WebLocalStorageDB`  
**Instance**: `export const db = new WebLocalStorageDB()`

## Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `bp_products` | `Product[]` | All extracted/compared products |
| `bp_shopping_list` | `ShoppingListItem[]` | User's shopping list |
| `bp_uploads` | `BroshureUpload[]` | Upload history & status |
| `bp_custom_search_urls` | `CustomSearchUrl[]` | Custom supermarket search templates |
| `bp_api_data_sources` | `ApiDataSource[]` | REST API data sources for online price search |
| `bp_receipts` | `Receipt[]` | Scanned/manual receipts |
| `bp_gemini_api_key` | `string` | User's Gemini API key |
| `bp_gemini_selected_model` | `string` | Selected model name |
| `bp_discovered_models` | `Array<{name, displayName}>` | Cached model list from API |
| `bp_gsheets_enabled` | `string` | "true"/"false" |
| `bp_gsheets_ssid` | `string` | Google Sheet ID |
| `bp_gsheets_url` | `string` | GAS Web App URL |

## CRUD Operations

### Products
```typescript
getProducts(): Product[]
saveProduct(product: Product)           // Upsert by ID
deleteProduct(id: string)
saveProducts(newProducts: Product[])    // Batch upsert
clearAllProducts()
```

### Shopping List
```typescript
getShoppingList(): ShoppingListItem[]
saveShoppingListItem(item: ShoppingListItem)
deleteShoppingListItem(id: string)
clearShoppingList()
```

### Uploads
```typescript
getUploads(): BroshureUpload[]
saveUpload(upload: BroshureUpload)
deleteUpload(id: string)
```

### Custom Search URLs
```typescript
getCustomSearchUrls(): CustomSearchUrl[]  // Seeds 5 Argentine defaults if empty
saveCustomSearchUrl(urlItem: CustomSearchUrl)
deleteCustomSearchUrl(id: string)
```

### Api Data Sources
```typescript
getApiDataSources(): ApiDataSource[]  // Seeds Mercado Libre Argentina default if empty
saveApiDataSource(ds: ApiDataSource)
deleteApiDataSource(id: string)
```

### Receipts
```typescript
getReceipts(): Receipt[]
saveReceipt(receipt: Receipt)
deleteReceipt(id: string)
clearReceipts()
```

### Config
```typescript
getApiKey(): string
saveApiKey(key: string)
getSelectedModel(): string
saveSelectedModel(model: string)
getDiscoveredModels(): Array<{name, displayName}>
saveDiscoveredModels(models: Array<{name, displayName}>)
```

## Default Seeding

`getCustomSearchUrls()` auto-seeds 5 Argentine supermarkets if storage empty:
- Carrefour, Coto, Jumbo, Día, ChangoMas

`getApiDataSources()` auto-seeds Mercado Libre Argentina if storage empty:
- Uses official Mercado Libre API (`api.mercadolibre.com/sites/MLA/search`)

`getDiscoveredModels()` defaults to 4 Gemini models if empty.

## Sync with React State

App.tsx loads all data on mount:
```typescript
useEffect(() => {
  setProducts(db.getProducts());
  setShoppingList(db.getShoppingList());
  setUploads(db.getUploads());
  setApiKey(db.getApiKey());
  setReceipts(db.getReceipts());
  setCustomSearchUrls(db.getCustomSearchUrls());
  setApiDataSources(db.getApiDataSources());
  // ... GSheets config from localStorage
}, []);
```

After mutations, components call `db.saveX()` then `setX(db.getX())` to refresh UI.

## Limitations

- **No transactions**: Each save is independent
- **No indexing**: Full array scans for lookups (fine for <10k items)
- **5-10MB quota**: localStorage limit per origin
- **Sync manual**: GSheets sync is separate, not automatic backup