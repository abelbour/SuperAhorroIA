# State Management

## Pattern

**Single-component state** in `App.tsx` using `useState` + `useEffect`. No external state library (Redux, Zustand, Context).

## State Categories

### 1. Core Data (synced with DB)
```typescript
const [products, setProducts] = useState<Product[]>([]);
const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
const [uploads, setUploads] = useState<BroshureUpload[]>([]);
const [receipts, setReceipts] = useState<Receipt[]>([]);
const [customSearchUrls, setCustomSearchUrls] = useState<CustomSearchUrl[]>([]);
```
- Loaded once on mount from `db.getX()`
- Updated via `db.saveX()` then `setX(db.getX())`

### 2. UI State (ephemeral)
```typescript
const [activeTab, setActiveTab] = useState<"home" | "upload" | ...>("home");
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
const [categoryFilter, setCategoryFilter] = useState("All");
const [supermarketFilter, setSupermarketFilter] = useState("All");
const [sortBy, setSortBy] = useState<...>("name");
```

### 3. Form / Editing State
```typescript
// Upload preview
const [extractedPreview, setExtractedPreview] = useState<{supermarket, items} | null>(null);
const [previewStartDate, setPreviewStartDate] = useState("");
const [previewEndDate, setPreviewEndDate] = useState("");

// Receipt editing
const [editingReceipt, setEditingReceipt] = useState<Partial<Receipt> | null>(null);
const [newReceiptItemName, setNewReceiptItemName] = useState("");
// ... more item fields

// Shopping list custom item
const [customItemName, setCustomItemName] = useState("");
// ... more fields

// Custom search URL form
const [newSearchUrlName, setNewSearchUrlName] = useState("");
// ...
```

### 4. Async Status Flags
```typescript
const [isProcessing, setIsProcessing] = useState(false);
const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
const [isUpdatingModels, setIsUpdatingModels] = useState(false);
const [isSyncingGSheets, setIsSyncingGSheets] = useState(false);
const [isCameraActive, setIsCameraActive] = useState(false);
const [isCurrentlyScanning, setIsCurrentlyScanning] = useState(false);
```

### 5. API & Config
```typescript
const [apiKey, setApiKey] = useState("");
const [selectedModel, setSelectedModel] = useState(db.getSelectedModel());
const [discoveredModels, setDiscoveredModels] = useState([...]);
const [gsheetsEnabled, setGsheetsEnabled] = useState(false);
const [gsheetsSSID, setGsheetsSSID] = useState("");
const [gsheetsUrl, setGsheetsUrl] = useState("");
```

### 6. Notifications
```typescript
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
```
- Auto-dismiss via `triggerError()` / `triggerSuccess()` helpers (4-6s timeout)

### 7. Camera / Media
```typescript
const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
const [scannedItem, setScannedItem] = useState<SinglePriceScanResult | null>(null);
const [scanCapturedImage, setScanCapturedImage] = useState<string | null>(null);
const videoRef = useRef<HTMLVideoElement | null>(null);
```

### 8. PWA
```typescript
const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
const [isInstallable, setIsInstallable] = useState(false);
```

## Key Patterns

### Initialization (mount)
```typescript
useEffect(() => {
  setProducts(db.getProducts());
  // ... all initial loads
  
  // URL param handling for GSheets sharing
  const params = new URLSearchParams(window.location.search);
  // ...
  
  // Event listeners: online/offline, beforeinstallprompt
}, []);
```

### Debounced Cloud Sync
```typescript
useEffect(() => {
  if (!gsheetsEnabled || !gsheetsUrl) return;
  if (isFirstSyncRun.current) { isFirstSyncRun.current = false; return; }
  
  const handler = setTimeout(() => triggerCloudSync(products, receipts), 1500);
  return () => clearTimeout(handler);
}, [products, receipts, gsheetsEnabled, gsheetsUrl]);
```

### Camera Cleanup on Tab Switch
```typescript
useEffect(() => {
  if (activeTab !== "scan") stopCamera();
}, [activeTab]);
```

### Derived State (useMemo)
```typescript
const filteredProducts = useMemo(() => 
  products.filter(...).sort(...), 
  [products, searchQuery, categoryFilter, supermarketFilter, sortBy]
);

const categories = useMemo(() => 
  [...new Set(products.map(p => p.category))].sort(), 
  [products]
);
```

## Data Flow

```
User Action
    │
    ▼
Event Handler (e.g., handleSaveReceipt)
    │
    ├──▶ db.saveX(data)  ──▶ localStorage
    │
    └──▶ setX(db.getX())  ──▶ React Re-render
```