/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAlerts } from "./useAlerts";
import {
  Search,
  Upload,
  Plus,
  Trash,
  Check,
  Settings,
  Sparkles,
  TrendingUp,
  ShoppingCart,
  Store,
  ArrowRight,
  Download,
  AlertCircle,
  Calendar,
  DollarSign,
  Globe,
  FileText,
  CheckCircle2,
  Calculator,
  RefreshCw,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Info,
  Camera,
  ScanLine,
  Database,
  Save,
  Share2,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutDashboard,
  Receipt as ReceiptIcon,
  Bell,
  AlertTriangle,
  Calculator as CalcIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import InflationTab from "./InflationTab";
import { Product, ShoppingListItem, BroshureUpload, CatalogSource, Receipt, ReceiptItem, ApiProductResult, StoreAnalysisResult, PriceAlert } from "./types";
import { db } from "./db";
import {
  getUnitNormalization,
  formatUnitPrice,
  convertToCSV,
  parseCSV,
  translateCategory,
  cleanHtmlForGemini,
  getPublicProxies
} from "./utils";
import { 
  fileToBase64,
  parseBrochureWithGemini, 
  normalizeExtractedItems, 
  ParseResult,
  scanSinglePriceWithGemini,
  SinglePriceScanResult,
  interpretSearchUrlWithGemini,
  parseReceiptWithGemini,
  ReceiptParseResult,
  suggestShoppingListWithGemini,
  ShoppingListSuggestion,
  parseApiResults,
  parseScrapedResults,
  analyzeStoreForApi
} from "./gemini";
import CatalogSourceForm from "./CatalogSourceForm";
import DebouncedInput from "./DebouncedInput";
import StoreAnalyzerWizard from "./StoreAnalyzerWizard";
import GSheetsConfigForm from "./GSheetsConfigForm";
import CatalogTab from "./CatalogTab";
import ScanTab from "./ScanTab";
import ConfirmDialog from "./ConfirmDialog";
import ShoppingListTab from "./ShoppingListTab";

export default function App() {
  // Shared States
  const [products, setProducts] = useState<Product[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [uploads, setUploads] = useState<BroshureUpload[]>([]);
  const [apiKey, setApiKey] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(db.getSelectedModel());
  const [discoveredModels, setDiscoveredModels] = useState<Array<{name: string, displayName: string}>>(db.getDiscoveredModels());
  const [isUpdatingModels, setIsUpdatingModels] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"home" | "upload" | "catalog" | "shopping" | "settings" | "scan" | "receipts" | "inflation">("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("bp_dark_mode") === "true");
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    const saved = localStorage.getItem("bp_monthly_budget");
    return saved ? Number(saved) : 0;
  });
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => db.getAlerts());
  const [newAlertName, setNewAlertName] = useState("");
  const [newAlertTarget, setNewAlertTarget] = useState("");
  const { errorMessage, successMessage, triggerError, triggerSuccess, setErrorMessage, setSuccessMessage } = useAlerts();
  const refreshAlerts = useCallback(() => setAlerts(db.getAlerts()), []);
  const createAlert = useCallback((productName: string, currentPrice: number) => {
    db.saveAlert({
      id: `alert-${Date.now()}`,
      productName,
      productId: "",
      targetPrice: currentPrice * 0.9,
      currentBestPrice: currentPrice,
      active: true,
      createdAt: new Date().toISOString(),
    });
    refreshAlerts();
    triggerSuccess(`Alerta creada para "${productName}". Te avisaremos si baja de $${(currentPrice * 0.9).toFixed(0)}.`);
  }, [refreshAlerts, triggerSuccess]);

  // Check alerts whenever products change
  useEffect(() => {
    alerts.forEach(alert => {
      if (!alert.active) return;
      const currentBest = products
        .filter(p => p.name.toLowerCase().includes(alert.productName.toLowerCase()))
        .reduce((min, p) => Math.min(min, p.salePrice), Infinity);
      if (currentBest !== Infinity && currentBest <= alert.targetPrice && alert.lastTriggeredAt !== "notified") {
        db.saveAlert({ ...alert, lastTriggeredAt: "notified" });
        triggerSuccess(`¡"${alert.productName}" bajó a $${currentBest.toFixed(0)}!`);
      }
    });
    refreshAlerts();
  }, [products, triggerSuccess, refreshAlerts]);

  // Receipts / Tickets States
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState<boolean>(false);
  const [editingReceipt, setEditingReceipt] = useState<Partial<Receipt> | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptErrorMessage, setReceiptErrorMessage] = useState<string | null>(null);
  
  // Receipt manual item state
  const [newReceiptItemName, setNewReceiptItemName] = useState<string>("");
  const [newReceiptItemPrice, setNewReceiptItemPrice] = useState<string>("");
  const [newReceiptItemAmount, setNewReceiptItemAmount] = useState<string>("1");
  const [newReceiptItemUnit, setNewReceiptItemUnit] = useState<string>("units");
  const [newReceiptItemCategory, setNewReceiptItemCategory] = useState<string>("Pantry");

  // Shopping List Smart Suggestions
  const [suggestedItems, setSuggestedItems] = useState<ShoppingListSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<boolean>(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  
  // Statuses
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // AbortController for deduplicating search requests
  const searchAbortRef = useRef<AbortController | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    variant?: "danger" | "default";
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const requestConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, variant: "danger" | "default" = "default", confirmLabel?: string) => {
      setConfirmDialog({ title, message, variant, confirmLabel, onConfirm });
    },
    []
  );

  // Upload/AI states
  const [manualSupermarket, setManualSupermarket] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedPreview, setExtractedPreview] = useState<{
    supermarket: string;
    items: Product[];
  } | null>(null);

  // Camera Scanner States
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedItem, setScannedItem] = useState<SinglePriceScanResult | null>(null);
  const [isCurrentlyScanning, setIsCurrentlyScanning] = useState<boolean>(false);
  const [scanCapturedImage, setScanCapturedImage] = useState<string | null>(null); // base64 string
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Catalog sources (unified store configs)
  const [catalogSources, setCatalogSources] = useState<CatalogSource[]>([]);
  const [interpretingSourceId, setInterpretingSourceId] = useState<string | null>(null);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [supermarketFilter, setSupermarketFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"name" | "price_asc" | "price_desc" | "unitprice_asc">("name");

  // Google Sheets DB Sync States
  const [gsheetsEnabled, setGsheetsEnabled] = useState<boolean>(false);
  const [gsheetsSSID, setGsheetsSSID] = useState<string>("");
  const [gsheetsUrl, setGsheetsUrl] = useState<string>("");
  const [isSyncingGSheets, setIsSyncingGSheets] = useState<boolean>(false);
  const [gsheetsSyncStatus, setGsheetsSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [gsheetsSyncMessage, setGsheetsSyncMessage] = useState<string>("");

  // Extracted brochure leaflet duration dates
  const [previewStartDate, setPreviewStartDate] = useState<string>("");
  const [previewEndDate, setPreviewEndDate] = useState<string>("");

  // Comparison details modal/panel state
  const [selectedCompareProduct, setSelectedCompareProduct] = useState<Product | null>(null);

  // Shopping List entry helper
  const [customItemName, setCustomItemName] = useState<string>("");
  const [customItemCategory, setCustomItemCategory] = useState<string>("Produce");
  const [customItemPrice, setCustomItemPrice] = useState<string>("");
  const [customItemSupermarket, setCustomItemSupermarket] = useState<string>("Tienda Manual");
  const [customItemAmount, setCustomItemAmount] = useState<string>("1");
  const [customItemUnit, setCustomItemUnit] = useState<string>("unit");

  // PWA Support
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);

  // Online search results
  const [onlineSearchResults, setOnlineSearchResults] = useState<ApiProductResult[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState<boolean>(false);
  const [onlineSearchQuery, setOnlineSearchQuery] = useState<string>("");
  const [editingCatalogSource, setEditingCatalogSource] = useState<CatalogSource | null>(null);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [loginSource, setLoginSource] = useState<CatalogSource | null>(null);
  const [loginFormData, setLoginFormData] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ id: string; status: number; body: string; bodyPreview: string; method: string } | null>(null);

  // Store analysis wizard state
  /* wizard state moved to StoreAnalyzerWizard component */

  const isFirstSyncRun = useRef<boolean>(true);

  const refreshGeminiModels = async (keyToUse = apiKey) => {
    if (!keyToUse) {
      return;
    }
    setIsUpdatingModels(true);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyToUse}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.models && Array.isArray(data.models)) {
        const filtered = data.models
          .filter((m: any) => {
            const hasGenerate = m.supportedGenerationMethods?.includes("generateContent");
            const isGemini = m.name?.toLowerCase().includes("gemini");
            return hasGenerate && isGemini;
          })
          .map((m: any) => {
            const originName = m.name || "";
            const shortName = originName.startsWith("models/") ? originName.slice(7) : originName;
            const dispName = m.displayName || shortName;
            return {
              name: shortName,
              displayName: `${dispName} (${shortName})`
            };
          });

        if (filtered.length > 0) {
          db.saveDiscoveredModels(filtered);
          setDiscoveredModels(filtered);
          triggerSuccess("¡Lista de modelos de IA actualizada automáticamente desde los servidores de Google!");
        } else {
          throw new Error("No se encontraron modelos válidos que admitan generateContent.");
        }
      } else {
        throw new Error("La respuesta de la API no contiene el listado de modelos.");
      }
    } catch (err: any) {
      console.error("No se pudo actualizar la lista de modelos de forma inteligente:", err);
      triggerSuccess(`Uso de modelos locales de resguardo (no se pudo actualizar la lista remota: ${err.message || err})`);
    } finally {
      setIsUpdatingModels(false);
    }
  };

  // Helper to trigger cloud push of core database tables
  const triggerCloudSync = (updatedProducts?: Product[], updatedReceipts?: Receipt[]) => {
    const isEnabled = localStorage.getItem("bp_gsheets_enabled") === "true";
    const url = localStorage.getItem("bp_gsheets_url") || "";
    const ssid = localStorage.getItem("bp_gsheets_ssid") || "";

    if (!isEnabled || !url) return;

    const p = updatedProducts || db.getProducts();
    const r = updatedReceipts || db.getReceipts();

    const postData = {
      action: "syncAll",
      ssid: ssid,
      products: p,
      receipts: r,
      configs: {
        gemini_api_key: db.getApiKey(),
        catalog_sources: JSON.stringify(db.getCatalogSources())
      }
    };

    fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(postData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        console.log("Auto-sincronización con Google Sheets completada de fondo.");
        setGsheetsSyncStatus("success");
        setGsheetsSyncMessage("¡Cambios sincronizados en la nube!");
      } else {
        console.warn("Auto-sincronización falló:", data.message);
        setGsheetsSyncStatus("error");
        setGsheetsSyncMessage(`La auto-sincronización falló: ${data.message}`);
      }
    })
    .catch(err => {
      console.error("Auto-sync background fetch failed:", err);
      setGsheetsSyncStatus("error");
      setGsheetsSyncMessage(`La conexión de sincronización falló.`);
    });
  };

  // Trigger a full sync (read and merge) from GSheets Web App URL
  const handleSyncGSheets = async (targetUrl?: string, targetSsid?: string) => {
    const url = targetUrl || gsheetsUrl || localStorage.getItem("bp_gsheets_url") || "";
    const ssid = targetSsid !== undefined ? targetSsid : (gsheetsSSID || localStorage.getItem("bp_gsheets_ssid") || "");
    
    if (!url) {
      setGsheetsSyncStatus("error");
      setGsheetsSyncMessage("Falta configurar la URL de la Web App de GAS.");
      return;
    }

    setIsSyncingGSheets(true);
    setGsheetsSyncStatus("idle");
    setGsheetsSyncMessage("Estableciendo conexión con Google Sheets...");

    try {
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=read&ssid=${encodeURIComponent(ssid)}&t=${Date.now()}`;
      const response = await fetch(fetchUrl, {
        method: "GET",
        mode: "cors"
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      if (json.status === "success") {
        let mergedProducts = [...db.getProducts()];
        let mergedReceipts = [...db.getReceipts()];
        
        if (json.products && Array.isArray(json.products)) {
          json.products.forEach((sp: Product) => {
            const idx = mergedProducts.findIndex(p => p.id === sp.id);
            if (idx >= 0) {
              mergedProducts[idx] = sp;
            } else {
              mergedProducts.push(sp);
            }
          });
        }

        if (json.receipts && Array.isArray(json.receipts)) {
          json.receipts.forEach((sr: Receipt) => {
            const idx = mergedReceipts.findIndex(r => r.id === sr.id);
            if (idx >= 0) {
              mergedReceipts[idx] = sr;
            } else {
              mergedReceipts.push(sr);
            }
          });
        }

        // Temp-key swap: save backup before clearing to prevent data loss on failure
        const prevProducts = db.getProducts();
        try {
          db.clearAllProducts();
          db.saveProducts(mergedProducts);
          mergedReceipts.forEach(r => db.saveReceipt(r));
        } catch (err) {
          db.saveProducts(prevProducts);
          throw err;
        }

        setProducts(mergedProducts);
        setReceipts(mergedReceipts);

          // Parse configurations if loaded from sheets
        if (json.configs) {
          const cfg = json.configs;
          if (cfg.gemini_api_key) {
            db.saveApiKey(cfg.gemini_api_key);
            setApiKey(cfg.gemini_api_key);
          }
          // NOTE: catalog_sources are NOT imported from sheet during GET.
          // Local state is source of truth; POST pushes it to sheet as a backup.
        }

        const postData = {
          action: "syncAll",
          ssid: ssid,
          products: mergedProducts,
          receipts: mergedReceipts,
          configs: {
            gemini_api_key: db.getApiKey(),
            catalog_sources: JSON.stringify(db.getCatalogSources())
          }
        };

        const postResponse = await fetch(url, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain"
          },
          body: JSON.stringify(postData)
        });

        const postJson = await postResponse.json();
        if (postJson.status === "success") {
          setGsheetsSyncStatus("success");
          setGsheetsSyncMessage("¡Base de datos y configuraciones sincronizadas con Google Sheets!");
        } else {
          throw new Error(postJson.message || "Error al subir datos fusionados");
        }
      } else {
        throw new Error(json.message || "Error al recuperar datos");
      }
    } catch (err: any) {
      console.error("GSheets Sync failed:", err);
      setGsheetsSyncStatus("error");
      setGsheetsSyncMessage(`La sincronización falló: ${err.message || err}`);
    } finally {
      setIsSyncingGSheets(false);
    }
  };

  // Synchronize state with Cloud GSheets on changes (debounced)
  useEffect(() => {
    if (!gsheetsEnabled || !gsheetsUrl) return;
    
    if (isFirstSyncRun.current) {
      isFirstSyncRun.current = false;
      return;
    }
    
    const handler = setTimeout(() => {
      triggerCloudSync(products, receipts);
    }, 1500);
    
    return () => clearTimeout(handler);
  }, [products, receipts, gsheetsEnabled, gsheetsUrl]);

  // Copy shareable deployment URL with GSheets SSID and GAS URL parameters
  const handleShareGSheets = () => {
    if (!gsheetsSSID && !gsheetsUrl) {
      triggerError("Por favor ingrese un SSID o una URL de GAS antes de compartir.");
      return;
    }
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("ssid");
    currentUrl.searchParams.delete("gasUrl");
    
    if (gsheetsSSID) {
      currentUrl.searchParams.set("ssid", gsheetsSSID);
    }
    if (gsheetsUrl) {
      currentUrl.searchParams.set("gasUrl", gsheetsUrl);
    }
    
    const shareableUrl = currentUrl.toString();

    navigator.clipboard.writeText(shareableUrl)
      .then(() => {
        let msg = "¡Enlace de sincronización copiado al portapapeles!";
        if (gsheetsSSID && gsheetsUrl) {
          msg = "¡Enlace de sincronización copiado (incluye SSID y GAS URL)!";
        } else if (gsheetsUrl) {
          msg = "¡Enlace de sincronización copiado (incluye GAS URL)!";
        } else {
          msg = "¡Enlace de sincronización copiado (incluye SSID)!";
        }
        triggerSuccess(msg);
      })
      .catch((err) => {
        console.error("Could not copy URL:", err);
        triggerError("No se pudo copiar el enlace automáticamente. Cópielo manualmente.");
      });
  };

  // Finds the last time a product was purchased by analyzing scanned/manual receipts
  const getLastPurchaseInfo = useCallback((itemName: string) => {
    if (!receipts || receipts.length === 0) return null;

    // Sort receipts by date descending (most recent first)
    const sortedReceipts = [...receipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const query = itemName.toLowerCase().trim();

    for (const receipt of sortedReceipts) {
      if (!receipt.items) continue;
      const match = receipt.items.find(it => {
        const name = it.name.toLowerCase().trim();
        return name === query || query.includes(name) || name.includes(query);
      });
      if (match) {
        return {
          totalPaidPrice: match.price,
          unitPriceOfItem: match.price / (match.amount || 1),
          amount: match.amount,
          unit: match.unit,
          date: receipt.date,
          store: receipt.store
        };
      }
    }
    return null;
  }, [receipts]);

  // Searches for active promotional offers from:
  // 1. Uploaded flyers (sourceType === "brochure")
  // 2. Online store catalogs (findSimilarOnlineProducts disabled — no preset data)
  const getBestAvailableOffer = useCallback((itemName: string, category: string) => {
    const query = itemName.toLowerCase().trim();

    // Find similar items inside our database with active offers
    const localMatches = products.filter(p => {
      // We look for brochure uploads or online parsed records
      if (p.sourceType !== "brochure" && p.sourceType !== "online") return false;
      const pName = p.name.toLowerCase().trim();
      return pName === query || pName.includes(query) || query.includes(pName);
    });

    const allOffers: Array<{
      supermarket: string;
      price: number;
      name: string;
      sourceType: "brochure" | "online" | "online_preset";
      startDate?: string;
      endDate?: string;
    }> = [];

    localMatches.forEach(m => {
      allOffers.push({
        supermarket: m.supermarket,
        price: m.salePrice,
        name: m.name,
        sourceType: m.sourceType === "brochure" ? "brochure" : "online",
        startDate: m.startDate,
        endDate: m.endDate
      });
    });

    if (allOffers.length === 0) return null;

    // Pick the absolute cheapest offer
    return allOffers.sort((a, b) => a.price - b.price)[0];
  }, [products]);

  // Dark mode toggle
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("bp_dark_mode", String(darkMode));
  }, [darkMode]);

  // Load all records on boot
  useEffect(() => {
    if (!localStorage.getItem("bp_migration_v2_complete")) {
      db.clearOldData();
      localStorage.setItem("bp_migration_v2_complete", "true");
    }
    setProducts(db.getProducts());
    setShoppingList(db.getShoppingList());
    setUploads(db.getUploads());
    setApiKey(db.getApiKey());
    setReceipts(db.getReceipts());
    setCatalogSources(db.getCatalogSources());

    const params = new URLSearchParams(window.location.search);
    const urlSsid = params.get("ssid");
    const urlGasUrl = params.get("gasUrl");

    let enabled = localStorage.getItem("bp_gsheets_enabled") === "true";
    let ssid = localStorage.getItem("bp_gsheets_ssid") || "";
    let url = localStorage.getItem("bp_gsheets_url") || "";

    if (urlSsid) {
      ssid = urlSsid;
      enabled = true;
      localStorage.setItem("bp_gsheets_ssid", urlSsid);
      localStorage.setItem("bp_gsheets_enabled", "true");
    }
    if (urlGasUrl) {
      url = urlGasUrl;
      enabled = true;
      localStorage.setItem("bp_gsheets_url", urlGasUrl);
      localStorage.setItem("bp_gsheets_enabled", "true");
    }

    setGsheetsEnabled(enabled);
    setGsheetsSSID(ssid);
    setGsheetsUrl(url);

    if (enabled && url) {
      handleSyncGSheets(url, ssid);
    }

    // Attempt to load extra presets from JSON (legacy, non-critical)
    fetch(`${import.meta.env.BASE_URL}supermarkets.json`)
      .then((res) => {
        if (!res.ok) throw new Error("No se encontró supermarkets.json");
        return res.json();
      })
      .then((jsonPresets: CatalogSource[]) => {
        if (jsonPresets && Array.isArray(jsonPresets)) {
          const currentList = db.getCatalogSources();
          let updated = [...currentList];
          let hasChanges = false;
          jsonPresets.forEach((preset) => {
            if (!currentList.some((s) => s.id === preset.id)) {
              updated.push(preset);
              db.saveCatalogSource(preset);
              hasChanges = true;
            }
          });
          if (hasChanges) {
            setCatalogSources(updated);
          }
        }
      })
      .catch(() => {});

    const savedApiKey = db.getApiKey();
    if (savedApiKey) {
      refreshGeminiModels(savedApiKey);
    }

    // Internet connection triggers
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // PWA Trigger installation listener
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Manage camera release on tab switch
  const isScanningRef = useRef(false);
  const cameraCleanupPendingRef = useRef(false);

  const doStopCamera = useCallback(() => {
    if (isScanningRef.current) {
      cameraCleanupPendingRef.current = true;
      return;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    cameraCleanupPendingRef.current = false;
  }, [cameraStream]);

  useEffect(() => {
    if (activeTab !== "scan") {
      doStopCamera();
    }
  }, [activeTab, doStopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScannedItem(null);
    setScanCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(`No se pudo acceder a la cámara: ${err.message || err}. También puedes usar el botón de carga manual.`);
    }
  }, [setCameraError, setScannedItem, setScanCapturedImage, setCameraStream, setIsCameraActive]);

  const stopCamera = useCallback(() => {
    doStopCamera();
  }, [doStopCamera]);

  const capturePhotoAndScan = useCallback(async () => {
    if (!videoRef.current || !cameraStream) {
      triggerError("La cámara no está activa. Inicia la cámara primero.");
      return;
    }
    if (!apiKey) {
      triggerError("Se requiere API Key de Gemini. Configúrala en Ajustes.");
      setActiveTab("settings");
      return;
    }

    setIsCurrentlyScanning(true);
    setCameraError(null);

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      setScanCapturedImage(dataUrl);
      const base64Data = dataUrl.split(",")[1];

      isScanningRef.current = true;

      doStopCamera();

      const result = await scanSinglePriceWithGemini(base64Data, "image/jpeg", apiKey);
      isScanningRef.current = false;
      if (cameraCleanupPendingRef.current) {
        doStopCamera();
      }
      setScannedItem(result);
      triggerSuccess(`Escaneado: ${result.productName} a $${result.price}`);
    } catch (err: any) {
      isScanningRef.current = false;
      if (cameraCleanupPendingRef.current) {
        doStopCamera();
      }
      console.error("Snapshot analysis failure:", err);
      setCameraError(`No se pudo analizar la etiqueta: ${err.message || err}`);
    } finally {
      setIsCurrentlyScanning(false);
    }
  }, [cameraStream, apiKey, triggerError, setActiveTab, setIsCurrentlyScanning, setCameraError, setScanCapturedImage, doStopCamera, scanSinglePriceWithGemini, triggerSuccess, setScannedItem]);

  const handleScanFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    if (!apiKey) {
      triggerError("Se requiere API Key de Gemini. Configúrala en Ajustes.");
      setActiveTab("settings");
      return;
    }

    const file = e.target.files[0];
    setIsCurrentlyScanning(true);
    setCameraError(null);
    setScannedItem(null);
    setScanCapturedImage(null);

    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || "image/jpeg";
      setScanCapturedImage(`data:${mimeType};base64,${base64}`);

      const result = await scanSinglePriceWithGemini(base64, mimeType, apiKey);
      setScannedItem(result);
      triggerSuccess(`Escaneado: ${result.productName} a $${result.price}`);
    } catch (err: any) {
      console.error("Uploaded file analysis failed:", err);
      setCameraError(`No se pudo analizar la etiqueta: ${err.message || err}`);
    } finally {
      setIsCurrentlyScanning(false);
    }
  }, [apiKey, triggerError, setActiveTab, setIsCurrentlyScanning, setCameraError, setScannedItem, setScanCapturedImage, fileToBase64, scanSinglePriceWithGemini, triggerSuccess]);

  const addScannedToCatalog = useCallback(() => {
    if (!scannedItem) return;

    const norm = getUnitNormalization(scannedItem.amount || 1, scannedItem.unit || "unit");
    const newProduct: Product = {
      id: `scanned-${Date.now()}`,
      name: scannedItem.productName,
      category: scannedItem.category || "Produce",
      originalPrice: scannedItem.price,
      salePrice: scannedItem.price,
      amount: scannedItem.amount || 1,
      unit: scannedItem.unit || "unit",
      supermarket: scannedItem.supermarket || "Tienda Escaneada",
      dateExtracted: new Date().toISOString(),
      unitPrice: scannedItem.price * norm.multiplier,
      baseUnit: norm.baseUnit,
      description: scannedItem.description || "Captured via smart camera scan scanner",
      sourceType: "manual"
    };

    db.saveProduct(newProduct);
    setProducts(db.getProducts());
    triggerSuccess(`"${scannedItem.productName}" agregado a la base de comparación.`);
    
    // reset scanner view
    setScannedItem(null);
    setScanCapturedImage(null);
  }, [scannedItem, setProducts, setScannedItem, setScanCapturedImage, triggerSuccess]);

  // ================= Receipts & Tickets Handlers =================

  const handleReceiptScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    if (!apiKey) {
      triggerError("Se requiere una API Key de Gemini en Ajustes para escanear tickets.");
      setActiveTab("settings");
      return;
    }

    const file = e.target.files[0];
    setReceiptFile(file);
    setIsProcessingReceipt(true);
    setReceiptErrorMessage(null);

    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || "image/jpeg";
      
      const parsed = await parseReceiptWithGemini(base64, mimeType, apiKey);
      
      setEditingReceipt({
        id: `receipt-${Date.now()}`,
        store: parsed.store || "Supermercado",
        date: parsed.date || new Date().toISOString().split("T")[0],
        items: parsed.items.map((it, idx) => ({
          id: `item-${idx}-${Date.now()}`,
          name: it.name,
          category: it.category || "Other",
          price: it.price || 0,
          amount: it.amount || 1,
          unit: it.unit || "units"
        })),
        totalAmount: parsed.totalAmount || parsed.items.reduce((sum, it) => sum + (it.price || 0), 0),
        isScanned: true
      });
      triggerSuccess("¡Ticket analizado con éxito! Revisa los artículos a continuación.");
    } catch (err: any) {
      console.error("Receipt scan failed:", err);
      setReceiptErrorMessage(`Error al escanear ticket: ${err.message || err}. Puedes cargarlo manualmente.`);
      handleCreateManualReceipt();
    } finally {
      setIsProcessingReceipt(false);
    }
  };

  const handleCreateManualReceipt = () => {
    setEditingReceipt({
      id: `receipt-${Date.now()}`,
      store: "",
      date: new Date().toISOString().split("T")[0],
      items: [],
      totalAmount: 0,
      isScanned: false
    });
    setReceiptErrorMessage(null);
  };

  const handleAddReceiptItem = () => {
    if (!editingReceipt) return;
    if (!newReceiptItemName.trim()) {
      triggerError("El nombre del artículo no puede estar vacío");
      return;
    }
    const priceVal = parseFloat(newReceiptItemPrice) || 0;
    const amountVal = parseFloat(newReceiptItemAmount) || 1;

    const newItem: ReceiptItem = {
      id: `item-${Date.now()}`,
      name: newReceiptItemName.trim(),
      category: newReceiptItemCategory,
      price: priceVal,
      amount: amountVal,
      unit: newReceiptItemUnit
    };

    const updatedItems = [...(editingReceipt.items || []), newItem];
    const updatedTotal = updatedItems.reduce((sum, item) => sum + item.price, 0);

    setEditingReceipt({
      ...editingReceipt,
      items: updatedItems,
      totalAmount: updatedTotal
    });

    setNewReceiptItemName("");
    setNewReceiptItemPrice("");
    setNewReceiptItemAmount("1");
    setNewReceiptItemUnit("units");
  };

  const handleRemoveReceiptItem = (id: string) => {
    if (!editingReceipt) return;
    const updatedItems = (editingReceipt.items || []).filter(item => item.id !== id);
    const updatedTotal = updatedItems.reduce((sum, item) => sum + item.price, 0);

    setEditingReceipt({
      ...editingReceipt,
      items: updatedItems,
      totalAmount: updatedTotal
    });
  };

  const handleEditReceiptItem = (itemId: string, field: keyof ReceiptItem, value: any) => {
    if (!editingReceipt || !editingReceipt.items) return;
    const updatedItems = editingReceipt.items.map(item => {
      if (item.id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    const updatedTotal = updatedItems.reduce((sum, item) => sum + item.price, 0);
    setEditingReceipt({
      ...editingReceipt,
      items: updatedItems,
      totalAmount: updatedTotal
    });
  };

  const handleSaveReceipt = () => {
    if (!editingReceipt) return;
    if (!editingReceipt.store?.trim()) {
      triggerError("Por favor ingresa el nombre de la tienda/supermercado");
      return;
    }
    if (!editingReceipt.date) {
      triggerError("Por favor selecciona una fecha válida");
      return;
    }
    if (!editingReceipt.items || editingReceipt.items.length === 0) {
      triggerError("Agrega al menos un artículo a tu ticket antes de guardarlo.");
      return;
    }

    const receiptToSave: Receipt = {
      id: editingReceipt.id || `receipt-${Date.now()}`,
      store: editingReceipt.store.trim(),
      date: editingReceipt.date,
      items: editingReceipt.items,
      totalAmount: editingReceipt.totalAmount || editingReceipt.items.reduce((sum, it) => sum + it.price, 0),
      isScanned: editingReceipt.isScanned || false
    };

    db.saveReceipt(receiptToSave);
    setReceipts(db.getReceipts());

    const productsToSave: Product[] = receiptToSave.items.map(item => {
      const standardAmount = item.amount || 1;
      const calculatedUnitPrice = item.price / standardAmount;
      const baseUnitVal = item.unit === "g" || item.unit === "kg" ? "kg" : item.unit === "ml" || item.unit === "L" ? "L" : "unit";
      
      return {
        id: `receipt-prod-${receiptToSave.id}-${item.id}`,
        name: item.name,
        category: item.category,
        originalPrice: item.price,
        salePrice: item.price,
        amount: item.amount,
        unit: item.unit,
        supermarket: receiptToSave.store,
        dateExtracted: receiptToSave.date + "T12:00:00Z",
        unitPrice: calculatedUnitPrice,
        baseUnit: baseUnitVal,
        sourceType: "receipt"
      };
    });

    db.saveProducts(productsToSave);
    setProducts(db.getProducts());

    setEditingReceipt(null);
    setReceiptFile(null);
    triggerSuccess(`¡Ticket de ${receiptToSave.store} guardado con éxito! Se registraron ${receiptToSave.items.length} precios en el sistema.`);
  };

  const handleDeleteReceipt = (id: string) => {
    requestConfirm(
      "¿Eliminar compra?",
      "Este recibo y los precios asociados se eliminarán del historial.",
      () => {
        db.deleteReceipt(id);
        setReceipts(db.getReceipts());
        triggerSuccess("Compra eliminada del historial.");
      },
      "danger",
      "Eliminar"
    );
  };

  const handleGenerateLocalSuggestions = useCallback(() => {
    const allItems: { name: string; category: string; store: string; price: number; count: number }[] = [];
    receipts.forEach(r => {
      r.items.forEach(it => {
        const name = it.name.trim();
        const existing = allItems.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.count += 1;
        } else {
          allItems.push({
            name,
            category: it.category,
            store: r.store,
            price: it.price,
            count: 1
          });
        }
      });
    });

    const sorted = allItems.sort((a,b) => b.count - a.count).slice(0, 8);
    const converted: ShoppingListSuggestion[] = sorted.map(item => ({
      name: item.name,
      category: item.category,
      supermarket: item.store,
      estimatedPrice: item.price,
      reason: `Comprado frecuentemente (${item.count} veces en total).`
    }));

    setSuggestedItems(converted);
    triggerSuccess("Sugerencias generadas basadas en frecuencia local.");
  }, [receipts, setSuggestedItems, triggerSuccess]);

  const handleGenerateAISuggestions = useCallback(async () => {
    if (receipts.length === 0) {
      triggerError("Necesitas registrar al menos una compra en tu historial para recibir sugerencias.");
      return;
    }
    if (!apiKey) {
      handleGenerateLocalSuggestions();
      return;
    }

    setIsGeneratingSuggestions(true);
    setSuggestionsError(null);

    try {
      const suggestions = await suggestShoppingListWithGemini(receipts, apiKey);
      setSuggestedItems(suggestions);
      triggerSuccess("¡Sugerencias de IA creadas! Revisa los recomendados.");
    } catch (err: any) {
      console.error("AI recommendations failed:", err);
      setSuggestionsError("Error al generar sugerencias de IA. Usando recomendador local.");
      handleGenerateLocalSuggestions();
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [receipts, apiKey, setSuggestedItems, setIsGeneratingSuggestions, setSuggestionsError, triggerError, triggerSuccess, handleGenerateLocalSuggestions]);

  const handleAddSuggestedToShopping = useCallback((suggestion: ShoppingListSuggestion) => {
    const itemId = `suggest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const shoppingListItem: ShoppingListItem = {
      id: itemId,
      productId: "manual",
      name: suggestion.name,
      category: suggestion.category,
      supermarket: suggestion.supermarket,
      price: suggestion.estimatedPrice,
      quantity: 1,
      unit: "u",
      amount: 1,
      unitPrice: suggestion.estimatedPrice,
      baseUnit: "unit",
      checked: false,
      notes: suggestion.reason
    };

    db.saveShoppingListItem(shoppingListItem);
    setShoppingList(db.getShoppingList());
    triggerSuccess(`¡Añadido ${shoppingListItem.name} a tu lista!`);
  }, [setShoppingList, triggerSuccess]);

  const handleAddAllSuggestions = () => {
    if (suggestedItems.length === 0) return;
    let count = 0;
    suggestedItems.forEach(suggestion => {
      const itemId = `suggest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const shoppingListItem: ShoppingListItem = {
        id: itemId,
        productId: "manual",
        name: suggestion.name,
        category: suggestion.category,
        supermarket: suggestion.supermarket,
        price: suggestion.estimatedPrice,
        quantity: 1,
        unit: "u",
        amount: 1,
        unitPrice: suggestion.estimatedPrice,
        baseUnit: "unit",
        checked: false,
        notes: suggestion.reason
      };
      db.saveShoppingListItem(shoppingListItem);
      count++;
    });

    setShoppingList(db.getShoppingList());
    setSuggestedItems([]);
    triggerSuccess(`¡Se añadieron ${count} productos sugeridos a tu planificador!`);
  };

  // Execute online price search across all enabled catalog sources (API + Scrape)
  const executeOnlineSearch = useCallback(async (query: string) => {
    // Cancel any in-flight search before starting a new one
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const abortController = new AbortController();
    searchAbortRef.current = abortController;

    if (!query.trim()) {
      triggerError("Ingresa un producto para buscar.");
      return;
    }
    const apiSources = catalogSources.filter(s => s.searchMethod === "api");
    const scrapeSources = catalogSources.filter(s => s.searchMethod === "scrape" && s.searchUrlTemplate);
    if (apiSources.length === 0 && scrapeSources.length === 0) {
      triggerError("No hay fuentes con búsqueda programática habilitada. Configúralas en Ajustes.");
      return;
    }

    setIsSearchingOnline(true);
    setOnlineSearchQuery(query.trim());
    setOnlineSearchResults([]);

    const rawResults: { sourceName: string; rawData: any }[] = [];
    const scrapedInputs: { sourceName: string; cleanedHtml: string; searchUrl: string }[] = [];
    const sourceErrors: { sourceName: string; error: string }[] = [];
    const encodedQuery = encodeURIComponent(query.trim());

    const signal = abortController.signal;
    async function tryFetch(url: string, opts?: RequestInit): Promise<Response | null> {
      try { return await fetch(url, { ...opts, signal }); } catch { return null; }
    }

    const gsheetsUrl = localStorage.getItem("bp_gsheets_url") || "";
    const gsheetsProxyEnabled = localStorage.getItem("bp_gsheets_proxy_enabled") !== "false";
    const publicProxyEnabled = localStorage.getItem("bp_public_proxy_enabled") !== "false";
    const PROXIES = publicProxyEnabled ? getPublicProxies() : [];

    async function fetchWithFallback(
      targetUrl: string, sourceName: string, fetchOptions?: RequestInit, isJson = true, sessionId?: string
    ): Promise<Response | null> {
      let response = await tryFetch(targetUrl, fetchOptions);
      if ((!response || !response.ok) && targetUrl !== gsheetsUrl && gsheetsUrl && gsheetsProxyEnabled) {
        try {
          const gasBody = JSON.stringify({
            action: "proxyFetch", targetUrl,
            method: fetchOptions?.method || "GET",
            headers: (fetchOptions?.headers as Record<string, string>) || {},
            body: (fetchOptions as any)?.body || null,
            ...(sessionId ? { sessionId } : {}),
          });
          console.log(`[${sourceName}] Trying GAS proxy for ${targetUrl.slice(0, 80)}...`);
          const gasRes = await fetch(gsheetsUrl, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain" }, body: gasBody, signal });
          const gasJson = await gasRes.json();
          if (gasJson.status === "success" && gasJson.body) {
            console.log(`[${sourceName}] GAS proxy succeeded, ${gasJson.body.length} bytes`);
            response = new Response(gasJson.body, { status: gasJson.responseCode || 200, headers: isJson ? { "Content-Type": "application/json" } : {} });
          } else {
            console.warn(`[${sourceName}] GAS proxy returned status="${gasJson.status}" body="${typeof gasJson.body}"`);
          }
        } catch (err: any) {
          console.warn(`[${sourceName}] GAS proxy fetch error:`, err.message || err);
        }
      }
      for (const tmpl of PROXIES) {
        if (response && response.ok) break;
        console.log(`[${sourceName}] Trying public proxy: ${tmpl}`);
        response = await tryFetch(tmpl.replace(/{url}/g, encodeURIComponent(targetUrl)), fetchOptions);
      }
      return response;
    }

    // API sources
    for (const s of apiSources) {
      let targetUrl = "";
      try {
        targetUrl = (s.apiUrl || "").replace(/{producto}/g, encodedQuery);
        const urlObj = new URL(targetUrl);
        if (s.apiQueryParams) {
          for (const key of Object.keys(s.apiQueryParams)) {
            urlObj.searchParams.set(key, (s.apiQueryParams[key] || "").replace(/{producto}/g, encodedQuery));
          }
        }
        const fetchOptions: RequestInit = { method: s.apiMethod || "GET" };
        if (s.apiHeaders) fetchOptions.headers = s.apiHeaders;
        if (s.apiMethod === "POST" && s.apiBodyTemplate) fetchOptions.body = s.apiBodyTemplate.replace(/{producto}/g, query.trim());

        targetUrl = urlObj.toString();
        console.log(`[${s.name}] Fetching API: ${targetUrl}`);
        const response = await fetchWithFallback(targetUrl, s.name, fetchOptions, true, s.sessionId);

        if (!response || !response.ok) {
          sourceErrors.push({ sourceName: s.name, error: response ? `HTTP ${response.status}` : "Sin conexión" });
          continue;
        }

        let rawData = await response.json();
        if (s.apiResponseJsonPath) {
          for (const part of s.apiResponseJsonPath.split(".")) {
            if (rawData && typeof rawData === "object" && part in rawData) rawData = rawData[part];
            else { rawData = []; break; }
          }
        }
        rawResults.push({ sourceName: s.name, rawData });
        console.log(`[${s.name}] API success: ${rawData.length} items`);
      } catch (err: any) {
        console.warn(`[${s.name}] API fetch failed:`, err.message);
        sourceErrors.push({ sourceName: s.name, error: err.message || "Error desconocido" });
      }
    }

    // Scrape sources
    for (const s of scrapeSources) {
      try {
        const scrapeUrl = (s.searchUrlTemplate || "").replace(/{producto}/g, encodedQuery);
        if (!scrapeUrl) continue;

        console.log(`[${s.name}] Scraping: ${scrapeUrl}`);
        const response = await fetchWithFallback(scrapeUrl, s.name, undefined, false, s.sessionId);
        if (!response || !response.ok) {
          sourceErrors.push({ sourceName: s.name, error: response ? `HTTP ${response.status}` : "Sin conexión" });
          continue;
        }

        const html = await response.text();
        const cleaned = cleanHtmlForGemini(html);
        scrapedInputs.push({ sourceName: s.name, cleanedHtml: cleaned, searchUrl: scrapeUrl });
        console.log(`[${s.name}] Scrape success: ${cleaned.length} chars cleaned`);
      } catch (err: any) {
        console.warn(`[${s.name}] Scrape fetch failed:`, err.message);
        sourceErrors.push({ sourceName: s.name, error: err.message || "Error desconocido" });
      }
    }

    // Price simulation for sources with salesChannel (VTEX Checkout Simulation API)
    const salesChannelSources = catalogSources.filter(s => s.salesChannel && s.searchMethod === "api");
    if (salesChannelSources.length > 0 && rawResults.length > 0) {
      for (const scSource of salesChannelSources) {
        const match = rawResults.find(r => r.sourceName === scSource.name);
        if (!match || !Array.isArray(match.rawData)) continue;

        const skuIds: string[] = [];
        for (const prod of match.rawData) {
          if (prod.items && Array.isArray(prod.items)) {
            for (const item of prod.items) {
              if (item.itemId) skuIds.push(item.itemId);
            }
          }
        }
        if (skuIds.length === 0) continue;

        const simItems = skuIds.slice(0, 10).map(id => ({ id, quantity: 1, seller: "1" }));
        const simBody = JSON.stringify({ items: simItems, sc: scSource.salesChannel, country: "ARG", postalCode: scSource.postalCode || undefined });

        try {
          const simUrl = scSource.apiUrl ? new URL(scSource.apiUrl).origin + "/api/checkout/pub/orderForms/simulation" : "";
          if (!simUrl) continue;

          console.log(`[${scSource.name}] Simulating ${simItems.length} items sc=${scSource.salesChannel}...`);
          const simResponse = await fetchWithFallback(simUrl, scSource.name + "_sim", { method: "POST", headers: { "Content-Type": "application/json" }, body: simBody }, true);

          if (simResponse && simResponse.ok) {
            const simResult = await simResponse.json();
            const simItemsArr = simResult.items || [];
            const priceMap = new Map<string, number>();
            const listPriceMap = new Map<string, number>();
            for (const si of simItemsArr) {
              if (si.id && si.price != null) {
                priceMap.set(si.id, si.price / 100);
                if (si.listPrice != null) listPriceMap.set(si.id, si.listPrice / 100);
              }
            }

            if (priceMap.size > 0) {
              for (const prod of match.rawData) {
                if (prod.items && Array.isArray(prod.items)) {
                  for (const item of prod.items) {
                    const simPrice = priceMap.get(item.itemId);
                    if (simPrice != null && item.sellers && item.sellers[0]?.commertialOffer) {
                      item.sellers[0].commertialOffer.Price = simPrice;
                      if (listPriceMap.has(item.itemId)) {
                        item.sellers[0].commertialOffer.ListPrice = listPriceMap.get(item.itemId);
                      }
                    }
                  }
                }
              }
              console.log(`[${scSource.name}] Applied ${priceMap.size} simulated prices`);
            }
          }
        } catch (simErr: any) {
          console.warn(`[${scSource.name}] Simulation failed:`, simErr.message);
        }
      }
    }

    if (rawResults.length === 0 && scrapedInputs.length === 0) {
      if (!signal.aborted) triggerError("No se pudieron obtener resultados de ninguna fuente.");
      setIsSearchingOnline(false);
      return;
    }

    if (signal.aborted) { setIsSearchingOnline(false); return; }

    try {
      if (!apiKey) {
        if (!signal.aborted) triggerError("Se requiere API Key de Gemini.");
        setIsSearchingOnline(false);
        return;
      }

      let allParsed: ApiProductResult[] = [];

      if (rawResults.length > 0) {
        const parsed = await parseApiResults(rawResults, query, apiKey);
        if (Array.isArray(parsed)) allParsed.push(...parsed);
      }

      if (scrapedInputs.length > 0) {
        const parsed = await parseScrapedResults(scrapedInputs, query, apiKey);
        if (Array.isArray(parsed)) allParsed.push(...parsed);
      }

      if (signal.aborted) { setIsSearchingOnline(false); return; }

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(Boolean);
      const scored = allParsed.map(item => {
        const nameLower = (item.productName + " " + (item.brand || "")).toLowerCase();
        const exactMatch = nameLower.includes(queryLower) ? 3 : 0;
        const wordMatch = queryWords.filter(w => nameLower.includes(w)).length;
        return { item, score: exactMatch + wordMatch };
      });
      scored.sort((a, b) => b.score - a.score);
      const matched = scored.filter(s => s.score > 0).map(s => s.item);
      const filtered = matched.length > 0 ? matched : allParsed;
      setOnlineSearchResults(filtered);
      if (filtered.length === 0) {
        triggerError("Gemini no pudo extraer productos de las respuestas.");
      } else {
        const totalSources = rawResults.length + scrapedInputs.length;
        triggerSuccess(`Se encontraron ${filtered.length} productos en ${totalSources} fuente(s).`);
      }
    } catch (err: any) {
      console.error("executeOnlineSearch parse error:", err);
      triggerError(`Error al procesar resultados: ${err.message}`);
    } finally {
      setIsSearchingOnline(false);
    }
  }, [catalogSources, apiKey, triggerError, triggerSuccess, setIsSearchingOnline, setOnlineSearchQuery, setOnlineSearchResults]);

  // Seed realistic grocery catalog brochures history to test Price History right away!
  const loadDemoData = () => {
    const demoUploads: BroshureUpload[] = [
      {
        id: "demo-upload-1",
        fileName: "marzo-super-ofertas.pdf",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        status: "completed",
        itemCount: 6,
      },
      {
        id: "demo-upload-2",
        fileName: "abril-circular-semanal.pdf",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        status: "completed",
        itemCount: 6,
      },
      {
        id: "demo-upload-3",
        fileName: "mayo-circular-semanal.pdf",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        status: "completed",
        itemCount: 6,
      },
      {
        id: "demo-upload-4",
        fileName: "dia-ofertas.pdf",
        supermarket: "Día",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        status: "completed",
        itemCount: 5,
      }
    ];

    // Build timeline details for key items
    const demoProducts: Product[] = [
      // Bananas - Carrefour Price Trend
      {
        id: "p1-cf-dt1",
        name: "Bananas",
        category: "Produce",
        originalPrice: 1200,
        salePrice: 990,
        amount: 1,
        unit: "kg",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 990,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p1-cf-dt2",
        name: "Bananas",
        category: "Produce",
        originalPrice: 1200,
        salePrice: 890,
        amount: 1,
        unit: "kg",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 890,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p1-cf-dt3",
        name: "Bananas",
        category: "Produce",
        originalPrice: 1200,
        salePrice: 820,
        amount: 1,
        unit: "kg",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 820,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p1-dia-dt1",
        name: "Bananas",
        category: "Produce",
        originalPrice: 1100,
        salePrice: 790,
        amount: 1,
        unit: "kg",
        supermarket: "Día",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 790,
        baseUnit: "kg",
        sourceType: "brochure"
      },

      // Leche Entera - Carrefour Trend
      {
        id: "p2-cf-dt1",
        name: "Leche Entera 1L",
        category: "Dairy",
        originalPrice: 1350,
        salePrice: 1190,
        amount: 1,
        unit: "L",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 1190,
        baseUnit: "L",
        sourceType: "brochure"
      },
      {
        id: "p2-cf-dt2",
        name: "Leche Entera 1L",
        category: "Dairy",
        originalPrice: 1350,
        salePrice: 1090,
        amount: 1,
        unit: "L",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 1090,
        baseUnit: "L",
        sourceType: "brochure"
      },
      {
        id: "p2-cf-dt3",
        name: "Leche Entera 1L",
        category: "Dairy",
        originalPrice: 1350,
        salePrice: 990,
        amount: 1,
        unit: "L",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 990,
        baseUnit: "L",
        sourceType: "brochure"
      },
      {
        id: "p2-dia-dt1",
        name: "Leche Entera 1L",
        category: "Dairy",
        originalPrice: 1250,
        salePrice: 950,
        amount: 1,
        unit: "L",
        supermarket: "Día",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 950,
        baseUnit: "L",
        sourceType: "brochure"
      },

      // Yogur firme 190g
      {
        id: "p3-cf-dt1",
        name: "Yogur Firme 190g",
        category: "Dairy",
        originalPrice: 1280,
        salePrice: 1050,
        amount: 190,
        unit: "g",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 5526,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p3-cf-dt2",
        name: "Yogur Firme 190g",
        category: "Dairy",
        originalPrice: 1280,
        salePrice: 990,
        amount: 190,
        unit: "g",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 5211,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p3-dia-dt1",
        name: "Yogur Firme 190g",
        category: "Dairy",
        originalPrice: 1090,
        salePrice: 890,
        amount: 190,
        unit: "g",
        supermarket: "Día",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 4684,
        baseUnit: "kg",
        sourceType: "brochure"
      },

      // Pechuga de Pollo
      {
        id: "p4-cf-dt1",
        name: "Pechuga de Pollo x kg",
        category: "Meat",
        originalPrice: 5500,
        salePrice: 4990,
        amount: 1,
        unit: "kg",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 4990,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p4-cf-dt2",
        name: "Pechuga de Pollo x kg",
        category: "Meat",
        originalPrice: 5500,
        salePrice: 4690,
        amount: 1,
        unit: "kg",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 4690,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p4-dia-dt1",
        name: "Pechuga de Pollo x kg",
        category: "Meat",
        originalPrice: 5200,
        salePrice: 4490,
        amount: 1,
        unit: "kg",
        supermarket: "Día",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 4490,
        baseUnit: "kg",
        sourceType: "brochure"
      },

      // Frutillas 500g
      {
        id: "p5-cf-dt1",
        name: "Frutillas 500g",
        category: "Produce",
        originalPrice: 2200,
        salePrice: 1890,
        amount: 500,
        unit: "g",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 3780,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p5-cf-dt2",
        name: "Frutillas 500g",
        category: "Produce",
        originalPrice: 2200,
        salePrice: 1690,
        amount: 500,
        unit: "g",
        supermarket: "Carrefour",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 3380,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p5-dia-dt1",
        name: "Frutillas 500g",
        category: "Produce",
        originalPrice: 2100,
        salePrice: 1590,
        amount: 500,
        unit: "g",
        supermarket: "Día",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 3180,
        baseUnit: "kg",
        sourceType: "brochure"
      }
    ];

    // Save to Local DB
    db.saveProducts(demoProducts);
    demoUploads.forEach(u => db.saveUpload(u));

    // Update frontend state
    setProducts(db.getProducts());
    setUploads(db.getUploads());
    triggerSuccess("¡Datos demo cargados! Ya podés comparar precios y ver tendencias.");
  };

  // Reset database completely
  const handleClearDb = () => {
    requestConfirm(
      "¿Borrar todos los datos?",
      "Se eliminarán todos los productos, la lista de compras y el historial de folletos. Esta acción no se puede deshacer.",
      () => {
        db.clearAllProducts();
        db.clearShoppingList();
        localStorage.removeItem("bp_uploads");
        setProducts([]);
        setShoppingList([]);
        setUploads([]);
        triggerSuccess("Base de datos borrada.");
      },
      "danger",
      "Borrar todo"
    );
  };

  // Handle PDF/Image brochure upload and call Gemini parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const processUpload = async () => {
    if (!selectedFile) {
      triggerError("Seleccioná o arrastrá un archivo PDF o imagen del folleto primero.");
      return;
    }
    if (!apiKey) {
      triggerError("Se requiere la API Key de Gemini. Agregala en Ajustes.");
      setActiveTab("settings");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const todayStr = new Date().toISOString().split("T")[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0];
    setPreviewStartDate(todayStr);
    setPreviewEndDate(nextWeekStr);

    const uploadId = `upload-${Date.now()}`;
    const initialUpload: BroshureUpload = {
      id: uploadId,
      fileName: selectedFile.name,
      supermarket: manualSupermarket.trim() || "Detecting...",
      dateExtracted: new Date().toISOString(),
      status: "processing",
      itemCount: 0,
    };

    // Save current upload status
    setUploads(prev => [initialUpload, ...prev]);
    db.saveUpload(initialUpload);

    try {
      // 1. Read file to Base64
      const mimeType = selectedFile.type || (selectedFile.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      const base64Data = await fileToBase64(selectedFile);

      // 2. Call Gemini
      const rawResult = await parseBrochureWithGemini(base64Data, mimeType, apiKey);

      // 3. Normalize items
      const parsedItems = normalizeExtractedItems(rawResult, "brochure", uploadId);

      // Set preview state for confirmation
      setExtractedPreview({
        supermarket: rawResult.supermarket || manualSupermarket || "Supermarket",
        items: parsedItems
      });

      // Update upload record
      const finishedUpload: BroshureUpload = {
        ...initialUpload,
        supermarket: rawResult.supermarket || manualSupermarket || "Supermarket",
        status: "completed",
        itemCount: parsedItems.length
      };
      setUploads(prev => prev.map(u => u.id === uploadId ? finishedUpload : u));
      db.saveUpload(finishedUpload);

      triggerSuccess("¡Folleto procesado con IA! Revisá los artículos a continuación.");
    } catch (err: any) {
      console.error(err);
      const failedUpload: BroshureUpload = {
        ...initialUpload,
        supermarket: manualSupermarket || "Unknown",
        status: "failed",
        itemCount: 0,
        errorMessage: err.message || "Error al procesar el archivo del folleto",
      };
      setUploads(prev => prev.map(u => u.id === uploadId ? failedUpload : u));
      db.saveUpload(failedUpload);
      triggerError(`Extraction Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
    }
  };

  // Preview approval
  const approvePreview = () => {
    if (!extractedPreview) return;
    
    const todayStr = new Date().toISOString().split("T")[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    // Attach default preview start & end dates if they are set
    const itemsWithDates = extractedPreview.items.map(item => ({
      ...item,
      startDate: item.startDate || previewStartDate || todayStr,
      endDate: item.endDate || previewEndDate || nextWeekStr
    }));

    // Save to DB
    db.saveProducts(itemsWithDates);
    setProducts(db.getProducts());

    setExtractedPreview(null);
    setManualSupermarket("");
    setPreviewStartDate("");
    setPreviewEndDate("");
    triggerSuccess(`Agregados ${itemsWithDates.length} artículos a la base de datos con fechas de campaña configuradas.`);
    setActiveTab("catalog");
  };

  const discardPreview = () => {
    requestConfirm(
      "¿Descartar artículos?",
      "Los artículos extraídos de este folleto no se guardarán en la base de datos.",
      () => {
        setExtractedPreview(null);
        setManualSupermarket("");
      },
      "default",
      "Descartar"
    );
  };

  const handleEditPreviewItem = (index: number, field: keyof Product, value: any) => {
    if (!extractedPreview) return;
    const updatedItems = [...extractedPreview.items];
    
    // cast to match field type safely
    let parsedValue = value;
    if (field === "originalPrice" || field === "salePrice" || field === "amount") {
      parsedValue = Number(value) || 0;
    }

    updatedItems[index] = {
      ...updatedItems[index],
      [field]: parsedValue
    };

    // Recalculate unit price if size, unit or sale price is changed
    if (field === "salePrice" || field === "amount" || field === "unit") {
      const item = updatedItems[index];
      const norm = getUnitNormalization(item.amount, item.unit);
      item.unitPrice = item.salePrice * norm.multiplier;
      item.baseUnit = norm.baseUnit;
    }

    setExtractedPreview({
      ...extractedPreview,
      items: updatedItems
    });
  };

  // List of unique supermarkets in catalog
  const uniqueSupermarkets = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => { if (p.supermarket) list.add(p.supermarket); });
    return Array.from(list);
  }, [products]);

  // Handle Manual addition of product to catalog
  const addManualProduct = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) return;

    const price = Number(customItemPrice) || 0;
    const amountVal = Number(customItemAmount) || 1;
    const norm = getUnitNormalization(amountVal, customItemUnit);
    const unitPrice = price * norm.multiplier;

    const newProduct: Product = {
      id: `manual-${Date.now()}`,
      name: customItemName.trim(),
      category: customItemCategory,
      originalPrice: price,
      salePrice: price,
      amount: amountVal,
      unit: customItemUnit,
      supermarket: customItemSupermarket.trim() || "Tienda Manual",
      dateExtracted: new Date().toISOString(),
      unitPrice,
      baseUnit: norm.baseUnit,
      sourceType: "manual"
    };

    db.saveProduct(newProduct);
    setProducts(db.getProducts());
    
    // Reset fields
    setCustomItemName("");
    setCustomItemPrice("");
    setCustomItemAmount("1");
    setCustomItemUnit("unit");

    triggerSuccess("Producto agregado al catálogo manualmente.");
  }, [customItemName, customItemPrice, customItemAmount, customItemUnit, customItemCategory, customItemSupermarket, setProducts, triggerSuccess]);

  // Remove individual catalog product
  const deleteProduct = useCallback((id: string) => {
    requestConfirm(
      "¿Eliminar producto?",
      "Este producto se eliminará de la base de datos de precios.",
      () => {
        db.deleteProduct(id);
        setProducts(db.getProducts());
        if (selectedCompareProduct?.id === id) {
          setSelectedCompareProduct(null);
        }
        triggerSuccess("Producto eliminado.");
      },
      "danger",
      "Eliminar"
    );
  }, [selectedCompareProduct, setProducts, setSelectedCompareProduct, triggerSuccess, requestConfirm]);

  // Add Item to Shopping List
  const addToShoppingList = useCallback((product: Product) => {
    const existing = shoppingList.find(item => item.productId === product.id);
    if (existing) {
      const updatedItem = { ...existing, quantity: existing.quantity + 1 };
      db.saveShoppingListItem(updatedItem);
    } else {
      const newItem: ShoppingListItem = {
        id: `list-${Date.now()}`,
        productId: product.id,
        name: product.name,
        category: product.category,
        supermarket: product.supermarket,
        price: product.salePrice,
        quantity: 1,
        unit: product.unit,
        amount: product.amount,
        unitPrice: product.unitPrice,
        baseUnit: product.baseUnit,
        checked: false
      };
      db.saveShoppingListItem(newItem);
    }
    setShoppingList(db.getShoppingList());
    triggerSuccess(`"${product.name}" agregado a tu lista de compras.`);
  }, [shoppingList, setShoppingList, triggerSuccess]);

  // Modify quantities on active shopping list
  const updateListItemQuantity = useCallback((id: string, qty: number) => {
    const item = shoppingList.find(l => l.id === id);
    if (!item) return;

    if (qty <= 0) {
      db.deleteShoppingListItem(id);
    } else {
      db.saveShoppingListItem({ ...item, quantity: qty });
    }
    setShoppingList(db.getShoppingList());
  }, [shoppingList, setShoppingList]);

  const toggleListItemChecked = useCallback((id: string) => {
    const item = shoppingList.find(l => l.id === id);
    if (!item) return;
    db.saveShoppingListItem({ ...item, checked: !item.checked });
    setShoppingList(db.getShoppingList());
  }, [shoppingList, setShoppingList]);

  const deleteListItem = useCallback((id: string) => {
    db.deleteShoppingListItem(id);
    setShoppingList(db.getShoppingList());
  }, [setShoppingList]);

  const clearList = useCallback(() => {
    requestConfirm(
      "¿Vaciar lista de compras?",
      "Todos los artículos de la lista se eliminarán.",
      () => {
        db.clearShoppingList();
        setShoppingList([]);
      },
      "danger",
      "Vaciar"
    );
  }, [setShoppingList, requestConfirm]);

  // Keep uniqueSupermarkets here since it is also used by shoppingOptimization
  // filteredProducts, productPriceHistory, catalogComparisons moved to CatalogTab

  // Global shopping budget optimizer calculations
  const shoppingOptimization = useMemo(() => {
    if (shoppingList.length === 0) return null;

    // We want to calculate:
    // 1. Total cost if we buy everything at Supermarket X
    // 2. Best combined option (buying each item where it is absolute cheapest)
    const supermarketsRepresented = Array.from(new Set([
      ...uniqueSupermarkets,
    ]));

    // Build standard structure mapping item name to price at each market
    const costsPerMarketObj: { [market: string]: { total: number; matchedCount: number; items: Array<{ name: string; price: number; originalSelectedPrice: number }> } } = {};

    supermarketsRepresented.forEach(m => {
      costsPerMarketObj[m] = { total: 0, matchedCount: 0, items: [] };
    });

    let absoluteCheapestCost = 0;
    const splitShoppingPlan: Array<{
      itemName: string;
      originalPrice: number;
      bestPrice: number;
      quantity: number;
      bestMarket: string;
      originalMarket: string;
    }> = [];

    // Evaluate each shopping item
    shoppingList.forEach(item => {
      const listNameClean = item.name.toLowerCase().trim();
      
      // Look up prices in local db for this item across other supermarkets
      const localMatches = products.filter(p => p.name.toLowerCase().trim() === listNameClean);
      
      // Collate all known prices for this product name
      const priceBook: { [market: string]: number } = { [item.supermarket]: item.price };
      
      localMatches.forEach(match => {
        // Only keep cheapest per supermarket
        if (!priceBook[match.supermarket] || match.salePrice < priceBook[match.supermarket]) {
          priceBook[match.supermarket] = match.salePrice;
        }
      });

      // Calculate totals for each market
      supermarketsRepresented.forEach(m => {
        if (priceBook[m] !== undefined) {
          costsPerMarketObj[m].total += priceBook[m] * item.quantity;
          costsPerMarketObj[m].matchedCount += 1;
          costsPerMarketObj[m].items.push({
            name: item.name,
            price: priceBook[m],
            originalSelectedPrice: item.price
          });
        } else {
          // If a supermarket doesn't have the product, we substitute with original price so we can still make a complete relative budget estimate
          costsPerMarketObj[m].total += item.price * item.quantity;
          costsPerMarketObj[m].items.push({
            name: item.name,
            price: item.price,
            originalSelectedPrice: item.price
          });
        }
      });

      // Identify absolute absolute best deal
      let minPrice = item.price;
      let bestStore = item.supermarket;

      Object.entries(priceBook).forEach(([store, price]) => {
        // Compare unit price where possible or standard price since packaging might slightly differ but let's base it on simple direct pricing
        if (price < minPrice) {
          minPrice = price;
          bestStore = store;
        }
      });

      absoluteCheapestCost += minPrice * item.quantity;
      splitShoppingPlan.push({
        itemName: item.name,
        originalPrice: item.price,
        bestPrice: minPrice,
        quantity: item.quantity,
        bestMarket: bestStore,
        originalMarket: item.supermarket,
      });
    });

    const activeSelectedListTotal = shoppingList.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const splitShoppingSavings = Math.max(0, activeSelectedListTotal - absoluteCheapestCost);
    const splitSavingsPct = activeSelectedListTotal > 0 ? (splitShoppingSavings / activeSelectedListTotal) * 100 : 0;

    return {
      activeSelectedListTotal,
      absoluteCheapestCost,
      splitShoppingSavings,
      splitSavingsPct,
      splitShoppingPlan,
      marketBudgets: Object.entries(costsPerMarketObj).map(([market, val]) => ({
        marketName: market,
        totalCost: val.total,
        matches: val.matchedCount,
        percentSaved: activeSelectedListTotal > 0 ? ((activeSelectedListTotal - val.total) / activeSelectedListTotal) * 100 : 0
      })).filter(b => b.totalCost > 0).sort((a, b) => a.totalCost - b.totalCost)
    };
  }, [shoppingList, products, uniqueSupermarkets]);

  // Export handling
  const handleExportCSV = useCallback(() => {
    if (products.length === 0) {
      triggerError("No hay datos para exportar. Procesá algunos folletos primero.");
      return;
    }
    const csvContent = convertToCSV(products);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `supermarket_price_data_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerSuccess("Catálogo exportado como CSV. Podés importarlo directamente en Google Sheets.");
  }, [products, triggerError, triggerSuccess]);

  // Custom Supermarket Search Engines Actions
  const handleSaveCatalogSource = (source: CatalogSource) => {
    if (!source.name.trim()) {
      triggerError("El nombre es obligatorio.");
      return;
    }
    db.saveCatalogSource(source);
    setCatalogSources(db.getCatalogSources());
    setEditingCatalogSource(null);
    triggerSuccess(`"${source.name}" guardado.`);
  };

  const handleDeleteCatalogSource = (id: string, name: string) => {
    db.deleteCatalogSource(id);
    setCatalogSources(db.getCatalogSources());
    if (editingCatalogSource?.id === id) setEditingCatalogSource(null);
    triggerSuccess(`"${name}" eliminado.`);
  };

  const handleInterpretCatalogSource = async (source: CatalogSource) => {
    if (!apiKey) {
      triggerError("Falta la clave API de Gemini. Configúrela primero en la sección de Ajustes.");
      return;
    }
    if (!source.searchUrlTemplate) {
      triggerError("Este catálogo no tiene URL de búsqueda configurada.");
      return;
    }
    setInterpretingSourceId(source.id);
    try {
      const result = await interpretSearchUrlWithGemini(source.name, source.searchUrlTemplate, apiKey);
      const updated: CatalogSource = {
        ...source,
        searchUrlTemplate: result.urlTemplate,
        aiInterpretation: `💡 **Análisis de IA:** ${result.aiExplanation}\n\n🏷️ **Tips de Ahorro:** ${result.tipsForUser}`
      };
      db.saveCatalogSource(updated);
      setCatalogSources(db.getCatalogSources());
      setEditingCatalogSource(updated);
      triggerSuccess(`¡IA interpretó correctamente el buscador de "${source.name}"!`);
    } catch (err: any) {
      console.error(err);
      triggerError("No se pudo interpretar el buscador con IA.");
    } finally {
      setInterpretingSourceId(null);
    }
  };

  const handleLoginCatalogSource = async (source: CatalogSource, formData: Record<string, string>, captchaToken?: string) => {
    if (!source.sessionLoginUrl || !source.sessionLoginFields) {
      triggerError("El catálogo no tiene configuración de login completa.");
      return;
    }
    const gsheetsUrl = localStorage.getItem("bp_gsheets_url") || "";
    if (!gsheetsUrl) {
      triggerError("El proxy GAS no está configurado. Configure la URL de GSheets primero.");
      return;
    }
    try {
      const loginPayload: Record<string, string> = {};
      for (const key of Object.keys(source.sessionLoginFields)) {
        const tmpl = source.sessionLoginFields[key];
        loginPayload[key] = tmpl.replace(/{(\w+)}/g, (_, name) => formData[name] || "");
      }
      const body = JSON.stringify({ action: "proxyLogin", loginUrl: source.sessionLoginUrl, loginPayload, captchaToken: captchaToken || null });
      const res = await fetch(gsheetsUrl, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain" }, body });
      const json = await res.json();
      if (json.status === "success" && json.sessionId) {
        const updated: CatalogSource = { ...source, sessionId: json.sessionId, sessionExpiresAt: undefined };
        db.saveCatalogSource(updated);
        setCatalogSources(db.getCatalogSources());
        setEditingCatalogSource(updated);
        triggerSuccess(`Sesión iniciada para "${source.name}".`);
      } else {
        triggerError(`Error al iniciar sesión: ${json.message || "Respuesta inesperada"}`);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      triggerError(`Error de conexión al iniciar sesión: ${err.message}`);
    }
  };

  const handleLogoutCatalogSource = async (source: CatalogSource) => {
    if (!source.sessionId) return;
    const gsheetsUrl = localStorage.getItem("bp_gsheets_url") || "";
    if (gsheetsUrl) {
      try {
        const body = JSON.stringify({ action: "proxyLogout", sessionId: source.sessionId });
        await fetch(gsheetsUrl, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain" }, body });
      } catch {}
    }
    const updated: CatalogSource = { ...source, sessionId: undefined, sessionExpiresAt: undefined };
    db.saveCatalogSource(updated);
    setCatalogSources(db.getCatalogSources());
    setEditingCatalogSource(updated);
    triggerSuccess(`Sesión cerrada para "${source.name}".`);
  };

  const handleAddApiProductToCatalog = useCallback((item: ApiProductResult) => {
    const norm = getUnitNormalization(item.amount, item.unit);
    const newProduct: Product = {
      id: `api-prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${item.brand ? item.brand + " " : ""}${item.productName}`,
      category: item.category || "Other",
      originalPrice: item.price,
      salePrice: item.price,
      amount: item.amount,
      unit: item.unit,
      supermarket: item.shop,
      dateExtracted: new Date().toISOString(),
      unitPrice: item.price * norm.multiplier,
      baseUnit: norm.baseUnit,
      description: item.discountsAndDeals || "",
      sourceType: "online",
    };
    db.saveProduct(newProduct);
    setProducts(db.getProducts());
    triggerSuccess(`"${newProduct.name}" agregado al catálogo.`);
  }, [setProducts, triggerSuccess]);

  const handleAddAllApiProductsToCatalog = useCallback(() => {
    let count = 0;
    onlineSearchResults.forEach(item => {
      const norm = getUnitNormalization(item.amount, item.unit);
      const newProduct: Product = {
        id: `api-prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: `${item.brand ? item.brand + " " : ""}${item.productName}`,
        category: item.category || "Other",
        originalPrice: item.price,
        salePrice: item.price,
        amount: item.amount,
        unit: item.unit,
        supermarket: item.shop,
        dateExtracted: new Date().toISOString(),
        unitPrice: item.price * norm.multiplier,
        baseUnit: norm.baseUnit,
        description: item.discountsAndDeals || "",
        sourceType: "online",
      };
      db.saveProduct(newProduct);
      count++;
    });
    setProducts(db.getProducts());
    setOnlineSearchResults([]);
    triggerSuccess(`${count} productos agregados al catálogo.`);
  }, [onlineSearchResults, setOnlineSearchResults, setProducts, triggerSuccess]);

  // Store analysis wizard handlers
  const handleAcceptWizardAnalysis = (analysis: StoreAnalysisResult) => {
    const baseSource: CatalogSource = {
      id: `cat-${Date.now()}`,
      name: analysis.storeName,
      websiteUrl: analysis.websiteUrl,
      siteSearchEnabled: true,
      searchMethod: "none",
    };

    if (analysis.methodType === "api" && analysis.apiConfig) {
      const cfg = analysis.apiConfig;
      let parsedHeaders: Record<string, string> | undefined;
      let parsedQueryParams: Record<string, string> | undefined;
      try { if (cfg.headers && typeof cfg.headers === "string") parsedHeaders = JSON.parse(cfg.headers); } catch {}
      try { if (cfg.queryParams && typeof cfg.queryParams === "string") parsedQueryParams = JSON.parse(cfg.queryParams); } catch {}

      const newSource: CatalogSource = {
        ...baseSource,
        description: cfg.description || `Configurado por IA para ${analysis.storeName}`,
        searchUrlTemplate: cfg.websiteUrl ? `${cfg.websiteUrl.replace(/\/$/, "")}/search?q={producto}` : undefined,
        searchMethod: "api",
        apiMethod: cfg.method,
        apiUrl: cfg.url,
        apiHeaders: parsedHeaders,
        apiQueryParams: parsedQueryParams,
        apiResponseJsonPath: cfg.responseJsonPath || undefined,
        apiCorsProxyUrl: cfg.corsProxyUrl || undefined,
        apiDefaultCategory: cfg.defaultCategory || "Other",
      };
      db.saveCatalogSource(newSource);
      setCatalogSources(db.getCatalogSources());
      triggerSuccess(`"${newSource.name}" agregado con API.`);
    } else if (analysis.methodType === "scrape" && analysis.scrapeConfig) {
      const cfg = analysis.scrapeConfig;
      const newSource: CatalogSource = {
        ...baseSource,
        description: `Configurado por IA para ${analysis.storeName}. ${cfg.notes || ""}`,
        searchUrlTemplate: cfg.searchUrlTemplate,
        aiInterpretation: `🔍 **Análisis de IA:** ${analysis.analysis}\n\n💡 **Tips:** ${analysis.tips}`,
        searchMethod: "scrape",
        scrapeNotes: cfg.notes || undefined,
      };
      db.saveCatalogSource(newSource);
      setCatalogSources(db.getCatalogSources());
      triggerSuccess(`"${newSource.name}" agregado con scraping web.`);
    } else {
      triggerError(`No se pudo configurar: ${analysis.analysis}`);
      return;
    }
  };

  const handleTestCatalogSource = async (source: CatalogSource) => {
    setTestingSourceId(source.id);
    setTestResult(null);
    const testQuery = "arroz";

    if (source.searchMethod === "api" && source.apiUrl) {
      try {
        let requestUrl = source.apiUrl.replace(/{producto}/g, encodeURIComponent(testQuery));
        const urlObj = new URL(requestUrl);
        if (source.apiQueryParams) {
          for (const key of Object.keys(source.apiQueryParams)) {
            urlObj.searchParams.set(key, source.apiQueryParams[key].replace(/{producto}/g, encodeURIComponent(testQuery)));
          }
        }
        const fetchOptions: RequestInit = { method: source.apiMethod || "GET" };
        if (source.apiHeaders) fetchOptions.headers = source.apiHeaders;
        if (source.apiMethod === "POST" && source.apiBodyTemplate) fetchOptions.body = source.apiBodyTemplate.replace(/{producto}/g, testQuery);

        const targetUrl = urlObj.toString();

        let response: Response | null = null;

        async function tryFetchNorm(url: string, opts: RequestInit): Promise<Response | null> {
          try { return await fetch(url, opts); } catch { return null; }
        }

        console.log(`[Test ${source.name}] Direct fetch: ${targetUrl}`);
        response = await tryFetchNorm(targetUrl, fetchOptions);
        if (!response && source.apiCorsProxyUrl) {
          const proxyUrl = source.apiCorsProxyUrl.replace(/{url}/g, encodeURIComponent(targetUrl));
          console.log(`[Test ${source.name}] Trying source cors proxy: ${proxyUrl}`);
          response = await tryFetchNorm(proxyUrl, fetchOptions);
        }
        if (!response) {
          const gsheetsUrl = localStorage.getItem("bp_gsheets_url") || "";
          if (gsheetsUrl && localStorage.getItem("bp_gsheets_proxy_enabled") !== "false") {
            try {
              console.log(`[Test ${source.name}] Trying GAS proxy...`);
              const gasBody = JSON.stringify({ action: "proxyFetch", targetUrl, method: source.apiMethod, headers: source.apiHeaders || {} });
              const gasRes = await fetch(gsheetsUrl, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain" }, body: gasBody });
              const gasJson = await gasRes.json();
              if (gasJson.status === "success" && gasJson.body) {
                console.log(`[Test ${source.name}] GAS proxy succeeded`);
                response = new Response(gasJson.body, { status: gasJson.responseCode || 200, headers: { "Content-Type": "application/json" } });
              } else {
                console.warn(`[Test ${source.name}] GAS proxy returned status="${gasJson.status}"`);
              }
            } catch (err: any) {
              console.warn(`[Test ${source.name}] GAS proxy error:`, err.message || err);
            }
          }
        }
        if (!response && localStorage.getItem("bp_public_proxy_enabled") !== "false") {
          const proxies = getPublicProxies();
          for (const tmpl of proxies) {
            response = await tryFetchNorm(tmpl.replace(/{url}/g, encodeURIComponent(targetUrl)), fetchOptions);
            if (response) break;
          }
        }

        if (!response) {
          setTestResult({ id: source.id, status: 0, body: "Sin respuesta", bodyPreview: "No se pudo conectar después de todos los intentos.", method: "api" });
          return;
        }

        const bodyText = await response.text();
        const preview = bodyText.length > 500 ? bodyText.slice(0, 500) + "\n... (truncado, " + bodyText.length + " chars total)" : bodyText;
        setTestResult({ id: source.id, status: response.status, body: bodyText, bodyPreview: preview, method: "api" });
      } catch (err: any) {
        setTestResult({ id: source.id, status: 0, body: err.message, bodyPreview: `Error: ${err.message}`, method: "api" });
      } finally {
        setTestingSourceId(null);
      }
      return;
    }

    if (source.searchMethod === "scrape") {
      const scrapeUrl = (source.searchUrlTemplate || "").replace(/{producto}/g, encodeURIComponent(testQuery));
      if (!scrapeUrl) {
        setTestResult({ id: source.id, status: 0, body: "Sin URL", bodyPreview: "No hay URL de búsqueda configurada.", method: "scrape" });
        setTestingSourceId(null);
        return;
      }
      try {
        let response: Response | null = null;
        async function tryFetch(url: string): Promise<Response | null> {
          try { return await fetch(url); } catch { return null; }
        }
        console.log(`[Test ${source.name}] Direct fetch: ${scrapeUrl}`);
        response = await tryFetch(scrapeUrl);
        if (!response) {
          const gsheetsUrl = localStorage.getItem("bp_gsheets_url") || "";
          if (gsheetsUrl && localStorage.getItem("bp_gsheets_proxy_enabled") !== "false") {
            try {
              console.log(`[Test ${source.name}] Trying GAS proxy...`);
              const gasBody = JSON.stringify({ action: "proxyFetch", targetUrl: scrapeUrl, method: "GET" });
              const gasRes = await fetch(gsheetsUrl, { method: "POST", mode: "cors", headers: { "Content-Type": "text/plain" }, body: gasBody });
              const gasJson = await gasRes.json();
              if (gasJson.status === "success" && gasJson.body) {
                console.log(`[Test ${source.name}] GAS proxy succeeded, ${gasJson.body.length} bytes`);
                response = new Response(gasJson.body, { status: gasJson.responseCode || 200 });
              } else {
                console.warn(`[Test ${source.name}] GAS proxy returned status="${gasJson.status}"`);
              }
            } catch (err: any) {
              console.warn(`[Test ${source.name}] GAS proxy error:`, err.message || err);
            }
          }
        }
        if (!response && localStorage.getItem("bp_public_proxy_enabled") !== "false") {
          const proxies = getPublicProxies();
          for (const tmpl of proxies) {
            console.log(`[Test ${source.name}] Trying public proxy: ${tmpl}`);
            response = await tryFetch(tmpl.replace(/{url}/g, encodeURIComponent(scrapeUrl)));
            if (response) break;
          }
        }
        if (!response) {
          setTestResult({ id: source.id, status: 0, body: "Sin respuesta", bodyPreview: "No se pudo conectar.", method: "scrape" });
          return;
        }
        const bodyText = await response.text();
        const cleaned = cleanHtmlForGemini(bodyText);
        const preview = cleaned.length > 500 ? cleaned.slice(0, 500) + "\n... (truncado, " + cleaned.length + " chars)" : cleaned;
        setTestResult({ id: source.id, status: response.status, body: cleaned, bodyPreview: preview, method: "scrape" });
      } catch (err: any) {
        setTestResult({ id: source.id, status: 0, body: err.message, bodyPreview: `Error: ${err.message}`, method: "scrape" });
      } finally {
        setTestingSourceId(null);
      }
      return;
    }

    setTestResult({ id: source.id, status: 0, body: "Sin método", bodyPreview: "Este catálogo no tiene API ni scraping configurado.", method: "none" });
    setTestingSourceId(null);
  };

  // PWA trigger installer
  const triggerAppInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-x-hidden">
      
      {/* Mobile Top Header (only on mobile) */}
      <header className="md:hidden sticky top-0 z-30 bg-slate-900 text-white shadow-md flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-lg shadow-inner">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-base">SuperAhorro</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isOnline ? "En Línea" : "Offline"}</span>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER BACKDROP */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* RESPONSIVE SIDEBAR (Drawer status on mobile, persistent on desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 md:fixed h-screen bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 border-r border-slate-800 shrink-0
          ${mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"}
          ${sidebarCollapsed ? "md:w-20" : "md:w-72"}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col whitespace-nowrap"
              >
                <span className="font-bold text-white text-base tracking-tight">SuperAhorro AI</span>
                <span className="text-[10px] text-slate-400">Escáner & Planificador</span>
              </motion.div>
            )}
          </div>

          {/* Close button for Mobile Drawer / Collapse Button for Desktop */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sidebar Navigation Options */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-none">
          {/* Opción Inicio (Página Principal) */}
          <button
            onClick={() => {
              setActiveTab("home");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition text-sm font-medium ${
              activeTab === "home"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
            }`}
            title="Inicio"
          >
            <Home className="w-4 h-4 shrink-0" />
            {(!sidebarCollapsed || mobileMenuOpen) && <span>Inicio</span>}
          </button>

          {/* Opción Catálogo */}
          <button
            onClick={() => {
              setActiveTab("catalog");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition text-sm font-medium ${
              activeTab === "catalog"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
            }`}
            title={`Catálogo (${products.length})`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <Store className="w-4 h-4 shrink-0" />
              {(!sidebarCollapsed || mobileMenuOpen) && <span className="truncate">Catálogo de Precios</span>}
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && products.length > 0 && (
              <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                {new Set(products.map(p => p.name)).size}
              </span>
            )}
          </button>

          {/* Opción Escáner */}
          <button
            onClick={() => {
              setActiveTab("scan");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition text-sm font-medium ${
              activeTab === "scan"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
            }`}
            title="Escáner de Góndola"
          >
            <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
            {(!sidebarCollapsed || mobileMenuOpen) && <span>Escáner de Góndola</span>}
          </button>

          {/* Opción Cargar Folletos */}
          <button
            onClick={() => {
              setActiveTab("upload");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition text-sm font-medium ${
              activeTab === "upload"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
            }`}
            title="Cargar Folletos"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <Upload className="w-4 h-4 shrink-0" />
              {(!sidebarCollapsed || mobileMenuOpen) && <span className="truncate">Cargar Folletos</span>}
            </div>
            {uploads.some(u => u.status === "processing") && (
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping mr-1" />
            )}
          </button>

          {/* Opción Lista de Compras */}
          <button
            onClick={() => {
              setActiveTab("shopping");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition text-sm font-medium ${
              activeTab === "shopping"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
            }`}
            title={`Lista (${shoppingList.length})`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <ShoppingCart className="w-4 h-4 shrink-0" />
              {(!sidebarCollapsed || mobileMenuOpen) && <span className="truncate">Lista de Compras</span>}
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && shoppingList.length > 0 && (
              <span className="bg-sky-500/20 text-sky-300 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                {shoppingList.length}
              </span>
            )}
          </button>

          {/* Opción Historial y Tickets */}
          <button
            onClick={() => {
              setActiveTab("receipts");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition text-sm font-medium ${
              activeTab === "receipts"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
            }`}
            title={`Historial (${receipts.length})`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <ReceiptIcon className="w-4 h-4 text-amber-400 shrink-0" />
              {(!sidebarCollapsed || mobileMenuOpen) && <span className="truncate">Historial y Tickets</span>}
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && receipts.length > 0 && (
              <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                {receipts.length}
              </span>
            )}
          </button>

          {/* Opción Inflación */}
          <button
            onClick={() => {
              setActiveTab("inflation");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition text-sm font-medium ${
              activeTab === "inflation"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
            }`}
            title="Inflación"
          >
            <TrendingUp className="w-4 h-4 text-rose-400 shrink-0" />
            {(!sidebarCollapsed || mobileMenuOpen) && <span>Inflación</span>}
          </button>

          {/* Opción Ajustes */}
          <button
            onClick={() => {
              setActiveTab("settings");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition text-sm font-medium ${
              activeTab === "settings"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent"
            }`}
            title="Ajustes y Buscadores"
          >
            <Settings className="w-4 h-4 shrink-0" />
            {(!sidebarCollapsed || mobileMenuOpen) && <span>Ajustes e IA</span>}
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex w-full items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs"
            title={darkMode ? "Modo claro" : "Modo oscuro"}
          >
            {darkMode ? "☀️" : "🌙"}
            {(!sidebarCollapsed || mobileMenuOpen) && <span className="ml-2">{darkMode ? "Modo claro" : "Modo oscuro"}</span>}
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-full items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <div className="flex items-center gap-2 text-xs"><ChevronLeft className="w-4 h-4" /><span>Colapsar menú</span></div>}
          </button>

          {/* Connection, Install and App Details (Desktop only, if expanded) */}
          {(!sidebarCollapsed || mobileMenuOpen) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2 text-xs p-1"
            >
              {/* Online/Offline Badge */}
              <div className={`px-2.5 py-1.5 rounded-xl flex items-center gap-2 ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {isOnline ? <Wifi className="w-3.5 h-3.5 animate-pulse" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span className="font-medium">{isOnline ? "Conectado al servidor" : "Modo Sin Conexión"}</span>
              </div>

              {/* Install PWA Button */}
              {isInstallable && (
                <button
                  id="btn-install"
                  onClick={triggerAppInstall}
                  className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Instalar Aplicación
                </button>
              )}
            </motion.div>
          )}
        </div>
      </aside>

      {/* Main Core View Area */}
      <main className={`flex-1 min-h-screen flex flex-col p-4 md:p-6 pb-12 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? "md:ml-20" : "md:ml-72"}`}>
        
        {/* Flash messages */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                    <p className="font-semibold text-sm">Atención</p>
                <p className="text-xs text-rose-700 mt-1">{errorMessage}</p>
              </div>
            </motion.div>
          )}

          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800 shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                    <p className="font-semibold text-sm">Éxito</p>
                <p className="text-xs text-emerald-700 mt-1">{successMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic content rendering based on activeTab */}
        <AnimatePresence mode="wait">
          
          {/* TAB 0: HOME PAGE (Página de Inicio) */}
          {activeTab === "home" && (
            <motion.div
              key="home-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-8 max-w-6xl mx-auto"
            >
              {/* Welcoming Display Header */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
                {/* Visual decoration overlay */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl -ml-20 -mb-20 pointer-events-none" />
                
                <div className="relative z-10 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs text-sky-300 font-medium border border-white/10">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Impulsado con Gemini AI</span>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                    ¡Tu Planificador de Ahorro Inteligente! 🛍️✨
                  </h1>
                  <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed font-sans">
                    Bienvenido a <strong className="text-white">SuperAhorro AI</strong>. Con esta herramienta puedes escanear precios en góndolas, cargar folletos promocionales de supermercados y planificar tu lista optimizando cada centavo en el comercio más económico.
                  </p>
                  
                  {/* Real-time stats pills */}
                  <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono text-slate-300">
                    <span className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
                      <Store className="w-3.5 h-3.5 text-indigo-400" />
                      {new Set(products.map(p => p.name)).size} Productos Registrados
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
                      <ShoppingCart className="w-3.5 h-3.5 text-rose-400" />
                      {shoppingList.length} Artículos Planeados
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
                      <ReceiptIcon className="w-3.5 h-3.5 text-amber-400" />
                      {receipts.length} Compras en Historial
                    </span>
                    {monthlyBudget > 0 && (() => {
                      const now = new Date();
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                      const spentThisMonth = receipts
                        .filter(r => r.date >= monthStart)
                        .reduce((sum, r) => sum + r.totalAmount, 0);
                      const pct = Math.min(100, (spentThisMonth / monthlyBudget) * 100);
                      return (
                        <span className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
                          <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">${spentThisMonth.toFixed(0)}</span>
                          <span className="text-slate-500">/ ${monthlyBudget.toFixed(0)}</span>
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{width: `${pct}%`}} />
                          </div>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Grid de Secciones de Acceso Directo */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-indigo-500" />
                    Secciones de la Aplicación
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  
                  {/* Card 1: Catálogo */}
                  <button
                    onClick={() => setActiveTab("catalog")}
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-95 shadow-sm cursor-pointer"
                  >
                    <div className="space-y-3 w-full">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl w-fit group-hover:bg-indigo-100 transition duration-200">
                        <Store className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition">
                        Catálogo de Precios
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">
                        Explora la base de datos local y de Google Sheets de supermercados con comparativas, tendencias de precios e historial de fluctuación.
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-indigo-600 w-full group-hover:translate-x-1 transition-transform">
                      <span>Ver Catálogo</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Card 2: Escáner */}
                  <button
                    onClick={() => setActiveTab("scan")}
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-95 shadow-sm cursor-pointer"
                  >
                    <div className="space-y-3 w-full">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit group-hover:bg-emerald-100 transition duration-200">
                        <Camera className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-emerald-600 transition">
                        Escáner de Góndola
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">
                        Escanea un cartel de precio en la góndola en tiempo real. La IA de Gemini analizará al instante si es una oferta real basándose en tu base de datos.
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-emerald-600 w-full group-hover:translate-x-1 transition-transform">
                      <span>Iniciar Escáner</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Card 3: Cargar Folletos */}
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-violet-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-95 shadow-sm cursor-pointer"
                  >
                    <div className="space-y-3 w-full">
                      <div className="p-3 bg-violet-50 text-violet-600 rounded-xl w-fit group-hover:bg-violet-100 transition duration-200">
                        <Upload className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-violet-600 transition">
                        Cargar Folletos
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">
                        Arrastra PDFs o fotos de folletos de ofertas. Gemini los procesará para ingresar ofertas cronometradas, marcas y empaques en lote de forma automática.
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-violet-600 w-full group-hover:translate-x-1 transition-transform">
                      <span>Procesar Folleto</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Card 4: Lista de Compras */}
                  <button
                    onClick={() => setActiveTab("shopping")}
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-rose-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-95 shadow-sm cursor-pointer"
                  >
                    <div className="space-y-3 w-full">
                      <div className="p-3 bg-rose-50 text-rose-600 rounded-xl w-fit group-hover:bg-rose-100 transition duration-200">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-rose-600 transition">
                        Lista de Compras
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">
                        Arma tu lista y deja que el sistema calcule el supermercado más conveniente. La IA te sugerirá compras optimizadas con un solo clic.
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-rose-600 w-full group-hover:translate-x-1 transition-transform">
                      <span>Abrir Planificador</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Card 5: Historial y Tickets */}
                  <button
                    onClick={() => setActiveTab("receipts")}
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-amber-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-95 shadow-sm cursor-pointer"
                  >
                    <div className="space-y-3 w-full">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-xl w-fit group-hover:bg-amber-100 transition duration-200">
                        <ReceiptIcon className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-amber-600 transition">
                        Historial y Tickets
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">
                        Registra tus compras pasadas escaneando tickets fiscales físicos. El parser de IA extraerá cantidades, nombres complejos y precios automáticamente.
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-amber-600 w-full group-hover:translate-x-1 transition-transform">
                      <span>Cargar Ticket</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Card 6: Ajustes e IA */}
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-95 shadow-sm cursor-pointer"
                  >
                    <div className="space-y-3 w-full">
                      <div className="p-3 bg-slate-50 text-slate-600 rounded-xl w-fit group-hover:bg-slate-100 transition duration-200">
                        <Settings className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-slate-600 transition">
                        Ajustes e Hojas de Cálculo
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">
                        Configura tu clave de Gemini API local, sincroniza tu base de datos completa con Google Sheets de forma bidireccional y edita buscadores inteligentes.
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-slate-600 w-full group-hover:translate-x-1 transition-transform">
                      <span>Configurar Ajustes</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                </div>
              </div>

             </motion.div>
           )}
 
            {/* TAB 1: CATALOG OF PRODUCTS */}
            {activeTab === "catalog" && (
              <CatalogTab
                products={products}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                supermarketFilter={supermarketFilter}
                setSupermarketFilter={setSupermarketFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
                uniqueSupermarkets={uniqueSupermarkets}
                selectedCompareProduct={selectedCompareProduct}
                setSelectedCompareProduct={setSelectedCompareProduct}
                customItemName={customItemName}
                setCustomItemName={setCustomItemName}
                customItemCategory={customItemCategory}
                setCustomItemCategory={setCustomItemCategory}
                customItemPrice={customItemPrice}
                setCustomItemPrice={setCustomItemPrice}
                customItemAmount={customItemAmount}
                setCustomItemAmount={setCustomItemAmount}
                customItemUnit={customItemUnit}
                setCustomItemUnit={setCustomItemUnit}
                customItemSupermarket={customItemSupermarket}
                setCustomItemSupermarket={setCustomItemSupermarket}
                onlineSearchResults={onlineSearchResults}
                onlineSearchQuery={onlineSearchQuery}
                setOnlineSearchQuery={setOnlineSearchQuery}
                isSearchingOnline={isSearchingOnline}
                executeOnlineSearch={executeOnlineSearch}
                addManualProduct={addManualProduct}
                deleteProduct={deleteProduct}
                addToShoppingList={addToShoppingList}
                handleAddApiProductToCatalog={handleAddApiProductToCatalog}
                handleAddAllApiProductsToCatalog={handleAddAllApiProductsToCatalog}
                setActiveTab={setActiveTab}
                onCreateAlert={createAlert}
              />
            )}

          {/* TAB: CAMERA SCAN PRICE TAG */}
          {activeTab === "scan" && (
            <ScanTab
              videoRef={videoRef}
              apiKey={apiKey}
              isCameraActive={isCameraActive}
              scannedItem={scannedItem}
              setScannedItem={setScannedItem}
              scanCapturedImage={scanCapturedImage}
              setScanCapturedImage={setScanCapturedImage}
              isCurrentlyScanning={isCurrentlyScanning}
              cameraError={cameraError}
              products={products}
              catalogSources={catalogSources}
              onlineSearchResults={onlineSearchResults}
              isSearchingOnline={isSearchingOnline}
              startCamera={startCamera}
              stopCamera={stopCamera}
              capturePhotoAndScan={capturePhotoAndScan}
              handleScanFileUpload={handleScanFileUpload}
              executeOnlineSearch={executeOnlineSearch}
              handleAddApiProductToCatalog={handleAddApiProductToCatalog}
              addScannedToCatalog={addScannedToCatalog}
              addToShoppingList={addToShoppingList}
              triggerSuccess={triggerSuccess}
              setActiveTab={setActiveTab}
            />
          )}
{/* TAB 2: UPLOAD & SCANNERS */}
          {activeTab === "upload" && (
            <motion.div
              key="upload-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto flex flex-col gap-6"
            >
              
              {/* API Key Missing alert */}
              {!apiKey && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-800">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Se requiere API Key de Gemini</p>
                    <p className="mt-1">
                      Para usar la extracción por IA, necesitás agregar tu API Key de Gemini primero. Todos los folletos se procesan localmente en tu navegador.
                    </p>
                    <button
                      onClick={() => setActiveTab("settings")}
                      className="mt-2.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg font-semibold transition text-[10px]"
                    >
                      Ingresar API Key
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Drag Box */}
              {!extractedPreview && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-sky-500" />
                      Cargar Folleto de Ofertas
                    </h3>
                    <p className="text-xs text-slate-500 mb-5">
                      Gemini AI analiza automáticamente folletos de supermercados: identifica productos, cantidades, categorías, precios de lista, descuentos y calcula precio por unidad.
                    </p>

                  <div className="flex flex-col gap-4">
                    
                    {/* Supermarket Brand Hint input */}
                    <div className="w-full sm:max-w-xs">
                        <label className="block text-slate-500 font-medium text-xs mb-1">
                          Nombre del Supermercado (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Carrefour, Coto, Día..."
                          value={manualSupermarket}
                          onChange={(e) => setManualSupermarket(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-sky-500 focus:outline-none"
                        />
                    </div>

                    {/* Drag and drop panel */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                        selectedFile
                          ? "border-sky-500 bg-sky-50/20"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <input
                        id="file-selector"
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label htmlFor="file-selector" className="cursor-pointer block">
                        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-800">
                          {selectedFile ? selectedFile.name : "Arrastrá el folleto acá"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : "Acepta PDF, JPG, PNG"}
                        </p>
                        <button
                          type="button"
                          className="mt-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
                        >
                          Seleccionar archivo
                        </button>
                      </label>
                    </div>

                    {/* Run action button */}
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" />
                        Subí una página de folleto o PDF
                      </span>
                      <button
                        onClick={processUpload}
                        disabled={isProcessing || !selectedFile}
                        className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition active:scale-95 flex items-center gap-2 shadow-md shrink-0"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Extrayendo precios con IA...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-sky-200" />
                            Analizar con IA
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* AI Extraction Preview Editor / Approval Gate */}
              {extractedPreview && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                  <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Vista previa de extracción con IA
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <h3 className="text-lg font-bold text-slate-800">Revisar precios ({extractedPreview.items.length} artículos)</h3>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={discardPreview}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition active:scale-95"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={approvePreview}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition active:scale-95 flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        Aprobar y guardar
                      </button>
                    </div>
                  </div>

                  {/* Campaign offer duration dates */}
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans text-xs">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        Fecha de Inicio de Oferta (Campaña Completa)
                      </label>
                      <input
                        id="brochure-start-date"
                        type="date"
                        value={previewStartDate}
                        onChange={(e) => setPreviewStartDate(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl p-2.5 focus:border-emerald-555 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-rose-500" />
                        Fecha de Caducidad de Oferta (Campaña Completa)
                      </label>
                      <input
                        id="brochure-end-date"
                        type="date"
                        value={previewEndDate}
                        onChange={(e) => setPreviewEndDate(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl p-2.5 focus:border-rose-555 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="text-xs bg-sky-50 text-sky-800 p-3 rounded-xl flex gap-2">
                    <Info className="w-4 h-4 text-sky-500 shrink-0" />
                    <p>
                      Supermercado detectado: <strong>{extractedPreview.supermarket}</strong>. Podés ajustar los artículos abajo si hace falta.
                    </p>
                  </div>

                  {/* Editable grid */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3">Producto</th>
                          <th className="p-3">Categoría</th>
                          <th className="p-3">Precio Original ($)</th>
                          <th className="p-3">Precio Oferta ($)</th>
                          <th className="p-3">Cantidad</th>
                          <th className="p-3">Unidad</th>
                          <th className="p-3">Supermercado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {extractedPreview.items.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleEditPreviewItem(index, "name", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.category}
                                onChange={(e) => handleEditPreviewItem(index, "category", e.target.value)}
                                className="w-full p-1 border border-slate-200 rounded focus:border-sky-500 focus:outline-none"
                              >
                                <option value="Produce">Produce</option>
                                <option value="Meat">Meat</option>
                                <option value="Dairy">Dairy</option>
                                <option value="Bakery">Bakery</option>
                                <option value="Pantry">Pantry</option>
                                <option value="Beverages">Beverages</option>
                                <option value="Household">Household</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td className="p-2 w-20">
                              <input
                                type="number"
                                step="0.01"
                                value={item.originalPrice}
                                onChange={(e) => handleEditPreviewItem(index, "originalPrice", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 w-20">
                              <input
                                type="number"
                                step="0.01"
                                value={item.salePrice}
                                onChange={(e) => handleEditPreviewItem(index, "salePrice", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 w-16">
                              <input
                                type="number"
                                step="any"
                                value={item.amount}
                                onChange={(e) => handleEditPreviewItem(index, "amount", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 w-20">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleEditPreviewItem(index, "unit", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded focus:border-sky-500 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 w-32">
                              <input
                                type="text"
                                value={extractedPreview.supermarket}
                                onChange={(e) => {
                                  const supermarket = e.target.value;
                                  const synced = extractedPreview.items.map(it => ({...it, supermarket}));
                                  setExtractedPreview({
                                    ...extractedPreview,
                                    supermarket,
                                    items: synced
                                  });
                                }}
                                className="w-full px-2 py-1 border border-slate-200 rounded focus:border-sky-500 focus:outline-none text-slate-800 font-semibold"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Upload Log list */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Historial de folletos procesados</h4>
                <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
                  
                  {uploads.map((upload) => (
                    <div key={upload.id} className="py-3 flex sm:items-center justify-between gap-3 text-xs flex-col sm:flex-row">
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 truncate block">{upload.fileName}</span>
                          <span className="text-[10px] text-slate-400">{new Date(upload.dateExtracted).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-500 mt-1 flex items-center gap-1">
                          <Store className="w-3 h-3" />
                          Supermarket: <strong className="text-slate-700">{upload.supermarket}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 justify-between shrink-0">
                        
                        <div>
                          {upload.status === "processing" ? (
                            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 font-semibold text-[10px] flex items-center gap-1">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Procesando...
                            </span>
                          ) : upload.status === "completed" ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold text-[10px] flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> {upload.itemCount} artículos
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-[10px] flex items-center gap-1" title={upload.errorMessage}>
                              <AlertCircle className="w-2.5 h-2.5" /> Failed
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            const uploadId = upload.id;
                            requestConfirm(
                              "¿Eliminar folleto?",
                              "Los productos extraídos de este folleto también se eliminarán.",
                              () => {
                                const remaining = products.filter(p => p.uploadId !== uploadId);
                                const prevProducts = db.getProducts();
                                try {
                                  db.clearAllProducts();
                                  db.saveProducts(remaining);
                                } catch (err) {
                                  db.saveProducts(prevProducts);
                                  throw err;
                                }
                                setProducts(remaining);
                                db.deleteUpload(uploadId);
                                setUploads(db.getUploads());
                                triggerSuccess("Folleto y sus productos eliminados.");
                              },
                              "danger",
                              "Eliminar"
                            );
                          }}
                          className="text-slate-300 hover:text-rose-500 p-1 rounded"
                          title="Eliminar entrada de folleto"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>

                      </div>

                    </div>
                  ))}

                  {uploads.length === 0 && (
                    <p className="text-slate-400 py-4 text-center">No hay folletos cargados todavía.</p>
                  )}

                </div>
              </div>

            </motion.div>
          )}

          {/* TAB: INFLACION */}
          {activeTab === "inflation" && (
            <InflationTab products={products} receiptsCount={receipts.length} />
          )}

          {/* TAB 3: SHOPPING LIST & BUDGET OPTIMIZER */}
          {activeTab === "shopping" && (
            <ShoppingListTab
              shoppingList={shoppingList}
              suggestedItems={suggestedItems}
              isGeneratingSuggestions={isGeneratingSuggestions}
              receipts={receipts}
              shoppingOptimization={shoppingOptimization}
              clearList={clearList}
              toggleListItemChecked={toggleListItemChecked}
              updateListItemQuantity={updateListItemQuantity}
              deleteListItem={deleteListItem}
              handleAddSuggestedToShopping={handleAddSuggestedToShopping}
              handleGenerateAISuggestions={handleGenerateAISuggestions}
              getLastPurchaseInfo={getLastPurchaseInfo}
              getBestAvailableOffer={getBestAvailableOffer}
              setShoppingList={setShoppingList}
              triggerSuccess={triggerSuccess}
            />
          )}
{/* TAB 6 (NUEVO): TICKETS Y COMPRAS */}
          {activeTab === "receipts" && (
            <motion.div
              key="receipts-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto flex flex-col gap-6"
            >
              {/* Header Title card */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-6 text-white shadow-md">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                      <ReceiptIcon className="w-6 h-6 text-amber-200" />
                      Historial de Tickets y Compras Realizadas
                    </h2>
                    <p className="text-xs text-amber-100 max-w-xl mt-1.5">
                      Al cargar tus tickets de compra, registramos los precios históricos reales de tus supermercados para alimentar el comparador de precios y el estimador de ahorro en Argentina.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      id="btn-manual-receipt"
                      onClick={handleCreateManualReceipt}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Cargar Manual
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload scanner area & error state */}
              {!editingReceipt && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Photo scanner widget */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col justify-center items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-3">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Escanear Ticket de Compra con IA</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                      Saca una foto nítida de tu recibo de supermercado. Nuestra IA identificará los artículos, categorías y los precios.
                    </p>

                    {isProcessingReceipt ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                        <span className="text-xs font-medium text-amber-600 animate-pulse">
                          Leyendo ticket con Gemini IA...
                        </span>
                        <span className="text-[10px] text-slate-400">Esto suele tomar unos segundos</span>
                      </div>
                    ) : (
                      <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:bg-slate-50/50 hover:border-amber-400 transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500 px-4">
                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                          <p className="text-xs font-medium text-slate-700">Arrastra tu recibo o haz clic aquí</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG o PDF. Max 10MB.</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleReceiptScanUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Smart shopping suggestions card */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 mb-3">
                          <ShoppingCart className="w-5 h-5" />
                        </div>
                        {receipts.length > 0 && suggestedItems.length > 0 && (
                          <button
                            onClick={handleAddAllSuggestions}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold py-1 px-2.5 rounded-lg transition"
                          >
                            Agregar Todo
                          </button>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">Generar Lista Sugerida desde Tickets</h3>
                      <p className="text-xs text-slate-500 mt-1 mb-4">
                        Nuestra IA evalúa tus patrones de compra históricos en Argentina y te sugiere los artículos que podrías necesitar reponer en tu lista de compras actual.
                      </p>

                      {isGeneratingSuggestions ? (
                        <div className="flex items-center gap-3 py-4 text-sky-600">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-xs font-semibold animate-pulse">Analizando compras recurrentes en historial...</span>
                        </div>
                      ) : suggestedItems.length > 0 ? (
                        <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto mb-4 scrollbar-none pr-1">
                          {suggestedItems.map((item, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl text-xs border border-slate-100">
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                  <Store className="w-2.5 h-2.5" />
                                  {item.supermarket} • <span className="text-sky-600 font-medium">{item.reason}</span>
                                </p>
                              </div>
                              <button
                                onClick={() => handleAddSuggestedToShopping(item)}
                                className="bg-sky-500 hover:bg-sky-600 text-white font-bold p-1 rounded-lg shrink-0"
                                title="Añadir a la lista"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-slate-50/50 rounded-2xl p-4 border border-dashed border-slate-200 text-center text-xs text-slate-400 py-6 mb-4 font-medium">
                          Haz clic abajo para generar recomendaciones basadas en tu historial de compras guardado.
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleGenerateAISuggestions}
                      disabled={receipts.length === 0 || isGeneratingSuggestions}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      {isGeneratingSuggestions ? "Procesando con IA..." : suggestedItems.length > 0 ? "Actualizar Sugerencias" : "Generar Sugerencias por IA"}
                    </button>
                  </div>
                </div>
              )}

              {/* Error messages state */}
              {receiptErrorMessage && (
                <div className="p-4 bg-orange-50 border border-orange-200 text-orange-700 rounded-2xl text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Nota de carga</p>
                    <p>{receiptErrorMessage}</p>
                  </div>
                </div>
              )}

              {/* ACTIVE RECEIPT EDITOR */}
              {editingReceipt && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col gap-6"
                >
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                    <div>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold uppercase tracking-wider">
                        {editingReceipt.isScanned ? "Escaneado por IA" : "Compra Manual"}
                      </span>
                      <h3 className="text-base font-bold text-slate-800 mt-1">Editor del Ticket de Compra</h3>
                    </div>
                    <button
                      onClick={() => setEditingReceipt(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  {/* Store & Date form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del Supermercado/Establecimiento *</label>
                      <div className="relative">
                        <Store className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Ej: Coto, Carrefour, DIA, Jumbo..."
                          value={editingReceipt.store || ""}
                          onChange={(e) => setEditingReceipt({ ...editingReceipt, store: e.target.value })}
                          className="w-full bg-slate-50 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium border border-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Fecha de la Compra *</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="date"
                          value={editingReceipt.date || ""}
                          onChange={(e) => setEditingReceipt({ ...editingReceipt, date: e.target.value })}
                          className="w-full bg-slate-50 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium border border-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Add manual item helper inside ticket */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/50">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Agregar artículo al ticket</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                      <div className="sm:col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Producto</label>
                        <input
                          type="text"
                          placeholder="Ej: Leche Entera"
                          value={newReceiptItemName}
                          onChange={(e) => setNewReceiptItemName(e.target.value)}
                          className="w-full bg-white rounded-lg py-2 px-3 text-xs border border-slate-250 focus:outline-none placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono">Precio total ($)</label>
                        <input
                          type="number"
                          placeholder="Ej: 850.50"
                          value={newReceiptItemPrice}
                          onChange={(e) => setNewReceiptItemPrice(e.target.value)}
                          className="w-full bg-white rounded-lg py-2 px-3 text-xs border border-slate-250 focus:outline-none placeholder:text-slate-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Vol/Peso</label>
                          <input
                            type="number"
                            placeholder="Ej: 1"
                            value={newReceiptItemAmount}
                            onChange={(e) => setNewReceiptItemAmount(e.target.value)}
                            className="w-full bg-white rounded-lg py-2 px-3 text-xs border border-slate-250 focus:outline-none placeholder:text-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Medida</label>
                          <select
                            value={newReceiptItemUnit}
                            onChange={(e) => setNewReceiptItemUnit(e.target.value)}
                            className="w-full bg-white rounded-lg py-2 px-1 text-xs border border-slate-250 focus:outline-none"
                          >
                            <option value="units">unidades</option>
                            <option value="kg">kg</option>
                            <option value="g">gramos</option>
                            <option value="L">litros</option>
                            <option value="ml">ml</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Categoría</label>
                        <select
                          value={newReceiptItemCategory}
                          onChange={(e) => setNewReceiptItemCategory(e.target.value)}
                          className="w-full bg-white rounded-lg py-2 px-2 text-xs border border-slate-250 focus:outline-none"
                        >
                          <option value="Produce">Verdulería / Frutas</option>
                          <option value="Meat">Carnicería / Pollo</option>
                          <option value="Dairy">Lácteos / Quesos</option>
                          <option value="Bakery">Panadería</option>
                          <option value="Pantry">Almacén (Pantry)</option>
                          <option value="Beverages">Bebidas</option>
                          <option value="Household">Limpieza / Hogar</option>
                          <option value="Other">Otros</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddReceiptItem}
                        className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-1.5 px-4 rounded-lg flex items-center gap-1 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Añadir al Ticket
                      </button>
                    </div>
                  </div>

                  {/* List of items inside ticket */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Artículos en este Ticket ({editingReceipt.items?.length || 0})</h4>
                    
                    {(!editingReceipt.items || editingReceipt.items.length === 0) ? (
                      <div className="text-center p-6 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        No hay productos en esta lista de tickets todavía.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 font-mono">
                              <th className="py-2.5">Producto</th>
                              <th className="py-2.5">Categoría</th>
                              <th className="py-2.5 w-24">Precio ($)</th>
                              <th className="py-2.5 w-28">Medida (Cant/Unidad)</th>
                              <th className="py-2.5 w-16 text-center"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {editingReceipt.items.map((item) => (
                              <tr key={item.id} className="border-b border-slate-100/50 text-xs">
                                <td className="py-2 pr-2">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => handleEditReceiptItem(item.id, "name", e.target.value)}
                                    className="bg-transparent font-medium text-slate-800 focus:bg-slate-50 focus:outline-none p-1 rounded w-full border border-transparent focus:border-slate-200"
                                  />
                                </td>
                                <td className="py-2 pr-2 text-slate-500">
                                  <select
                                    value={item.category}
                                    onChange={(e) => handleEditReceiptItem(item.id, "category", e.target.value)}
                                    className="bg-transparent border border-transparent hover:border-slate-250 p-1 rounded focus:outline-none"
                                  >
                                    <option value="Produce">Produce</option>
                                    <option value="Meat">Meat</option>
                                    <option value="Dairy">Dairy</option>
                                    <option value="Bakery">Bakery</option>
                                    <option value="Pantry">Pantry</option>
                                    <option value="Beverages">Beverages</option>
                                    <option value="Household">Household</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </td>
                                <td className="py-2 pr-2">
                                  <input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => handleEditReceiptItem(item.id, "price", parseFloat(e.target.value) || 0)}
                                    className="bg-transparent font-mono font-medium text-slate-800 focus:bg-slate-50 focus:outline-none p-1 rounded w-full border border-transparent focus:border-slate-200"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <div className="flex gap-1 items-center">
                                    <input
                                      type="number"
                                      value={item.amount}
                                      onChange={(e) => handleEditReceiptItem(item.id, "amount", parseFloat(e.target.value) || 1)}
                                      className="bg-transparent text-slate-700 w-12 text-center focus:bg-slate-50 focus:outline-none p-0.5 rounded border border-transparent focus:border-slate-200"
                                    />
                                    <select
                                      value={item.unit}
                                      onChange={(e) => handleEditReceiptItem(item.id, "unit", e.target.value)}
                                      className="bg-transparent text-slate-500 focus:outline-none p-0.5 text-[10px]"
                                    >
                                      <option value="units">unidades</option>
                                      <option value="kg">kg</option>
                                      <option value="g">gramos</option>
                                      <option value="L">litros</option>
                                      <option value="ml">ml</option>
                                    </select>
                                  </div>
                                </td>
                                <td className="py-2 text-center">
                                  <button
                                    onClick={() => handleRemoveReceiptItem(item.id)}
                                    className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Save button and total */}
                  <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-4 mt-2">
                    <div className="text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Total de esta Compra</span>
                      <span className="text-xl font-bold font-mono text-slate-800">
                        ${editingReceipt.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })} ARS
                      </span>
                    </div>
                    <div className="flex gap-2.5 w-full sm:w-auto">
                      <button
                        onClick={() => setEditingReceipt(null)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={handleSaveReceipt}
                        className="flex-1 sm:flex-initial px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        Guardar Compra
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STORED RECEIPTS HISTORY LIST */}
              {!editingReceipt && (
                <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                    <span>Historial de tickets guardados ({receipts.length})</span>
                    {receipts.length > 0 && (
                      <span className="text-xs font-bold font-mono text-emerald-600">
                        Monto total: ${receipts.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ARS
                      </span>
                    )}
                  </h3>

                  {receipts.length === 0 ? (
                    <div className="text-center py-12 px-6 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                      <ReceiptIcon className="w-12 h-12 text-slate-350 mb-1" />
                      <p className="text-xs font-semibold">No hay tickets registrados en el almacenamiento local.</p>
                      <p className="text-[10px] text-slate-400 max-w-sm">
                        Sube una foto de tu ticket arriba o haz clic en "Cargar Manual" en la sección de arriba para empezar.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {receipts.map((receipt) => (
                        <div key={receipt.id} className="border border-slate-100/85 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-4 flex flex-col justify-between shadow-xs transition">
                          <div>
                            <div className="flex justify-between items-start mb-2.5">
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <Store className="w-3.5 h-3.5 text-slate-500" />
                                  {receipt.store}
                                </h4>
                                <span className="text-[9px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                                  <Calendar className="w-3 h-3" />
                                  {receipt.date}
                                </span>
                              </div>
                              <span className="text-xs font-bold font-mono text-slate-800">
                                ${receipt.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {/* Bullet items under this ticket */}
                            <div className="flex flex-col gap-1 border-t border-slate-100/60 pt-2 mb-3">
                              {receipt.items.slice(0, 4).map((it) => (
                                <div key={it.id} className="flex justify-between items-center text-[10px] text-slate-550">
                                  <span className="truncate pr-2">• {it.name}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-slate-700">${it.price.toFixed(0)}</span>
                                    <button
                                      onClick={() => {
                                        const norm = getUnitNormalization(it.amount || 1, it.unit || "u");
                                        addToShoppingList({
                                          id: `receipt-${Date.now()}-${it.id}`,
                                          name: it.name,
                                          category: it.category || "Other",
                                          originalPrice: it.price,
                                          salePrice: it.price,
                                          amount: it.amount || 1,
                                          unit: it.unit || "u",
                                          supermarket: receipt.store,
                                          dateExtracted: new Date().toISOString(),
                                          unitPrice: it.price * norm.multiplier,
                                          baseUnit: norm.baseUnit,
                                          sourceType: "receipt",
                                        });
                                        triggerSuccess(`${it.name} agregado a la lista`);
                                      }}
                                      className="text-sky-500 hover:text-sky-700 font-bold px-1 leading-none"
                                      title="Agregar a la lista de compras"
                                    >+</button>
                                  </div>
                                </div>
                              ))}
                              {receipt.items.length > 4 && (
                                <p className="text-[9px] text-amber-600 font-semibold italic mt-0.5">
                                  + {receipt.items.length - 4} productos más...
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-100/60 pt-2 text-[10px] text-slate-400 mt-2">
                            <span>{receipt.items.length} artículos</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingReceipt({ ...receipt });
                                  setReceiptErrorMessage(null);
                                }}
                                className="text-amber-500 hover:text-amber-600 font-semibold cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteReceipt(receipt.id)}
                                className="text-rose-450 hover:text-rose-600 cursor-pointer"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 4: AJUSTES, BACKUPS Y BUSCADORES DE SUPERMERCADOS */}
          {activeTab === "settings" && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto flex flex-col gap-6"
            >
              
              {/* Ajustes de Clave de API de Gemini */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-sky-500 animate-pulse" />
                    Configurar API Key y Modelo de Gemini
                  </h3>
                  <p className="text-xs text-slate-500 font-sans">
                    Brinde su clave de API de Google Gemini para procesar folletos y etiquetas de precio en tiempo real directamente en el dispositivo. La clave se almacena localmente en su navegador y jamás se transmite a servidores intermedios de terceros.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Ingrese su GEMINI_API_KEY (Ej: AIzaSy...)"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      db.saveApiKey(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-sky-500 focus:outline-none placeholder-slate-400 font-mono"
                  />
                  <button
                    onClick={() => {
                      db.saveApiKey(apiKey);
                      triggerSuccess("Clave API de Gemini guardada de forma segura.");
                      refreshGeminiModels(apiKey);
                    }}
                    className="bg-slate-900 hover:bg-slate-950 text-white font-semibold px-4 py-2 rounded-xl text-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    Guardar Clave
                  </button>
                </div>

                {/* Selección Dinámica del Modelo */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="block text-slate-700 font-bold text-xs">
                        Seleccionar Modelo de Inteligencia Artificial (IA)
                      </label>
                      <p className="text-[10px] text-slate-400 mt-0.5 max-w-md font-sans">
                        Por defecto, recomendamos usar <strong>gemini-2.5-flash-lite</strong> para responder más rápido y utilizar exponencialmente menos tokens durante los análisis de folletos.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isUpdatingModels}
                      onClick={() => refreshGeminiModels(apiKey)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                        isUpdatingModels
                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-sky-50 border-sky-100 text-sky-600 hover:bg-sky-100"
                      }`}
                    >
                      <RefreshCw className={`w-3 h-3 ${isUpdatingModels ? "animate-spin" : ""}`} />
                      <span>{isUpdatingModels ? "Actualizando..." : "Actualizar Modelos"}</span>
                    </button>
                  </div>

                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedModel(val);
                      db.saveSelectedModel(val);
                      triggerSuccess(`Modelo de IA cambiado a: ${val}`);
                    }}
                    className="w-full bg-slate-50 text-slate-700 border border-slate-200 rounded-xl p-2.5 text-xs focus:border-sky-500 focus:outline-none font-mono cursor-pointer"
                  >
                    {discoveredModels.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.displayName}
                      </option>
                    ))}
                    {!discoveredModels.some((m) => m.name === selectedModel) && (
                      <option value={selectedModel}>{selectedModel} (Modelo Personalizado)</option>
                    )}
                  </select>
                </div>
                
                {apiKey ? (
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium pt-1 border-t border-slate-50">
                    <Check className="w-3.5 h-3.5 shrink-0" /> ¡Configuración API activa con modelo <strong className="font-mono">{selectedModel}</strong>! Listo para extraer folletos y escanear tickets.
                  </p>
                ) : (
                  <p className="text-[10px] text-rose-500 flex items-center gap-1 pt-1 border-t border-slate-50">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> No hay clave configurada. La funcionalidad de IA Inteligente está desactivada.
                  </p>
                )}
              </div>

              {/* Presupuesto mensual */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-base font-bold text-slate-800">Presupuesto Mensual</h3>
                </div>
                <p className="text-xs text-slate-500">Establecé un tope de gasto mensual. El progreso se calcula automáticamente desde los tickets escaneados.</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={monthlyBudget || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setMonthlyBudget(val);
                      localStorage.setItem("bp_monthly_budget", String(val));
                    }}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                    placeholder="Ej: 150000"
                  />
                  <span className="text-xs text-slate-400">ARS / mes</span>
                </div>
                {monthlyBudget > 0 && (() => {
                  const now = new Date();
                  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                  const spentThisMonth = receipts
                    .filter(r => r.date >= monthStart)
                    .reduce((sum, r) => sum + r.totalAmount, 0);
                  const pct = Math.min(100, (spentThisMonth / monthlyBudget) * 100);
                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Gastado este mes</span>
                        <span className="font-bold font-mono text-slate-700">${spentThisMonth.toFixed(0)} / ${monthlyBudget.toFixed(0)}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} style={{width: `${pct}%`}} />
                      </div>
                      {pct > 90 && <p className="text-[10px] text-rose-600 font-semibold">¡Cuidado! Estás cerca de alcanzar tu presupuesto mensual.</p>}
                    </div>
                  );
                })()}
              </div>

              {/* Alertas de precio */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-slate-800">Alertas de Precio</h3>
                </div>
                <p className="text-xs text-slate-500">Recibí una notificación cuando un producto baje de tu precio objetivo.</p>

                {/* Add new alert */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Producto</label>
                    <input
                      type="text"
                      value={newAlertName}
                      onChange={e => setNewAlertName(e.target.value)}
                      placeholder="Ej: Leche La Serenísima"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Precio máx.</label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={newAlertTarget}
                      onChange={e => setNewAlertTarget(e.target.value)}
                      placeholder="$"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const name = newAlertName.trim();
                      const target = Number(newAlertTarget);
                      if (!name || !target) { triggerError("Completá nombre y precio objetivo."); return; }
                      const bestPrice = products
                        .filter(p => p.name.toLowerCase().includes(name.toLowerCase()))
                        .reduce((min, p) => Math.min(min, p.salePrice), Infinity);
                      db.saveAlert({
                        id: `alert-${Date.now()}`,
                        productName: name,
                        productId: "",
                        targetPrice: target,
                        currentBestPrice: bestPrice === Infinity ? 0 : bestPrice,
                        active: true,
                        createdAt: new Date().toISOString(),
                      });
                      setNewAlertName(""); setNewAlertTarget("");
                      refreshAlerts();
                      triggerSuccess("Alerta creada. Te avisaremos cuando baje de precio.");
                    }}
                    className="px-3 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition cursor-pointer shrink-0"
                  >
                    Crear
                  </button>
                </div>

                {/* List of alerts */}
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hay alertas activas.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {alerts.map(alert => {
                      const currentBest = products
                        .filter(p => p.name.toLowerCase().includes(alert.productName.toLowerCase()))
                        .reduce((min, p) => Math.min(min, p.salePrice), Infinity);
                      const isTriggered = currentBest !== Infinity && currentBest <= alert.targetPrice;
                      return (
                        <div key={alert.id} className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                          isTriggered ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-700 truncate">{alert.productName}</p>
                            <p className="text-slate-400">
                              Objetivo: <span className="font-mono font-bold">${alert.targetPrice.toFixed(0)}</span>
                              {currentBest !== Infinity && (
                                <> · Mejor hoy: <span className={`font-mono font-bold ${isTriggered ? 'text-emerald-600' : 'text-rose-500'}`}>${currentBest.toFixed(0)}</span></>
                              )}
                              {isTriggered && <span className="ml-2 text-emerald-600 font-bold">✓ Alerta activa</span>}
                            </p>
                          </div>
                          <button
                            onClick={() => { db.deleteAlert(alert.id); refreshAlerts(); }}
                            className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-lg transition cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div id="panel-gsheets" className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                <GSheetsConfigForm
                  gsheetsUrl={gsheetsUrl}
                  gsheetsSSID={gsheetsSSID}
                  gsheetsEnabled={gsheetsEnabled}
                  isSyncing={isSyncingGSheets}
                  syncStatus={gsheetsSyncStatus}
                  syncMessage={gsheetsSyncMessage}
                  onToggleEnabled={(val) => {
                    setGsheetsEnabled(val);
                    localStorage.setItem("bp_gsheets_enabled", String(val));
                    triggerSuccess(val ? "Base de datos por Google Sheets habilitada." : "Base de datos deshabilitada.");
                  }}
                  onSync={(url, ssid) => {
                    setGsheetsUrl(url);
                    setGsheetsSSID(ssid);
                    localStorage.setItem("bp_gsheets_url", url);
                    localStorage.setItem("bp_gsheets_ssid", ssid);
                    handleSyncGSheets(url, ssid);
                  }}
                  onShare={handleShareGSheets}
                />

                  {/* Código GAS Instrucciones colapsables */}
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl">
                    <h4 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-500" />
                      Instrucciones de configuración (Google Apps Script)
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed mb-3 font-sans">
                      Siga estos pasos para sincronizar su cuenta de Google de forma gratuita: En Google Drive cree una hoja de cálculo, copie su ID de la dirección del navegador y péguelo arriba. En <strong>Extensiones &gt; Apps Script</strong> reemplace todo el código con el siguiente script de comunicación. Luego publique el servicio como Aplicación Web (acceso: Cualquiera) y configure la URL obtenida. <em>(Ahora guarda automáticamente la Clave de Gemini y Buscadores personalizados en la pestaña Configs)</em>.
                    </p>

                    <details className="group">
                      <summary className="text-[11px] text-emerald-750 hover:text-emerald-900 font-bold cursor-pointer flex items-center gap-1">
                        Ver Código Completo de Apps Script (GAS) para copiar
                      </summary>
                      <pre className="mt-2.5 max-h-[190px] overflow-y-auto bg-slate-900 text-slate-300 p-3 rounded-lg text-[9px] font-mono whitespace-pre select-all border border-slate-950">
{`/* 
  CÓDIGO COMPLETO DE GOOGLE APPS SCRIPT (GAS)
  Pegar esto íntegramente en Extensiones > Apps Script
*/

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("SuperAhorroIA")
    .addItem("Autorizar Proxy (UrlFetchApp)", "authorizeProxy")
    .addToUi();
}

function authorizeProxy() {
  UrlFetchApp.fetch("https://example.com");
  SpreadsheetApp.getUi().alert("Autorizado correctamente. Ya puede usar el proxy.");
}

function doGet(e) {
  var action = e.parameter.action;
  var ssid = e.parameter.ssid;
  
  if (!ssid) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "SSID is required" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var ss = SpreadsheetApp.openById(ssid);
    var pSheet = ss.getSheetByName("Products") || ss.insertSheet("Products");
    var rSheet = ss.getSheetByName("Receipts") || ss.insertSheet("Receipts");
    var cSheet = ss.getSheetByName("Configs") || ss.insertSheet("Configs");
    
    if (action === "read") {
      var pData = [];
      var pValues = pSheet.getDataRange().getValues();
      if (pValues.length > 1) {
        var headers = pValues[0];
        for (var i = 1; i < pValues.length; i++) {
          var row = pValues[i];
          var item = {};
          for (var j = 0; j < headers.length; j++) {
            item[headers[j]] = row[j];
          }
          item.originalPrice = Number(item.originalPrice) || 0;
          item.salePrice = Number(item.salePrice) || 0;
          item.amount = Number(item.amount) || 1;
          item.unitPrice = Number(item.unitPrice) || 0;
          pData.push(item);
        }
      }
      
      var rData = [];
      var rValues = rSheet.getDataRange().getValues();
      if (rValues.length > 1) {
        var headers = rValues[0];
        for (var i = 1; i < rValues.length; i++) {
          var row = rValues[i];
          var rawItems = row[4] || "[]";
          var itemsObj = [];
          try { itemsObj = JSON.parse(rawItems); } catch(err) {}
          
          rData.push({
            id: row[0],
            date: row[1],
            store: row[2],
            totalAmount: Number(row[3]) || 0,
            items: itemsObj
          });
        }
      }

      var cData = {};
      var cValues = cSheet.getDataRange().getValues();
      if (cValues.length > 1) {
        for (var i = 1; i < cValues.length; i++) {
          var key = cValues[i][0];
          var val = cValues[i][1];
          if (key) {
            cData[key] = val;
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        products: pData,
        receipts: rData,
        configs: cData
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var rawBody = e.postData.contents;
    var data = JSON.parse(rawBody);
    var action = data.action;
    
    if (action === "syncAll") {
      var ssid = data.ssid;
      var ss = SpreadsheetApp.openById(ssid);
      var pSheet = ss.getSheetByName("Products") || ss.insertSheet("Products");
      pSheet.clear();
      var pHeaders = ["id", "name", "category", "originalPrice", "salePrice", "amount", "unit", "baseUnit", "unitPrice", "supermarket", "sourceType", "startDate", "endDate", "dateExtracted"];
      pSheet.appendRow(pHeaders);
      
      if (data.products && data.products.length > 0) {
        var pRows = data.products.map(function(p) {
          return [
            p.id || "",
            p.name || "",
            p.category || "",
            p.originalPrice || 0,
            p.salePrice || 0,
            p.amount || 1,
            p.unit || "",
            p.baseUnit || "",
            p.unitPrice || 0,
            p.supermarket || "",
            p.sourceType || "",
            p.startDate || "",
            p.endDate || "",
            p.dateExtracted || ""
          ];
        });
        pSheet.getRange(2, 1, pRows.length, pHeaders.length).setValues(pRows);
      }
      
      var rSheet = ss.getSheetByName("Receipts") || ss.insertSheet("Receipts");
      rSheet.clear();
      var rHeaders = ["id", "date", "store", "totalAmount", "itemsJSON"];
      rSheet.appendRow(rHeaders);
      
      if (data.receipts && data.receipts.length > 0) {
        var rRows = data.receipts.map(function(r) {
          return [
            r.id || "",
            r.date || "",
            r.store || "",
            r.totalAmount || 0,
            JSON.stringify(r.items || [])
          ];
        });
        rSheet.getRange(2, 1, rRows.length, rHeaders.length).setValues(rRows);
      }

      var cSheet = ss.getSheetByName("Configs") || ss.insertSheet("Configs");
      cSheet.clear();
      cSheet.appendRow(["Key", "Value"]);
      if (data.configs) {
        var cRows = [];
        for (var k in data.configs) {
          cRows.push([k, data.configs[k]]);
        }
        if (cRows.length > 0) {
          cSheet.getRange(2, 1, cRows.length, 2).setValues(cRows);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "proxyLogin") {
      var loginUrl = data.loginUrl;
      var loginPayload = data.loginPayload || {};
      var captchaToken = data.captchaToken || null;
      var contentType = data.contentType || "application/x-www-form-urlencoded";

      if (captchaToken && loginPayload["token"] === "{captcha}") loginPayload["token"] = captchaToken;

      var loginOpts = {
        method: "POST",
        payload: loginPayload,
        contentType: contentType,
        muteHttpExceptions: true,
        followRedirects: true
      };
      var loginResponse = UrlFetchApp.fetch(loginUrl, loginOpts);
      var respHeaders = loginResponse.getHeaders();
      var allCookies = respHeaders["Set-Cookie"] || respHeaders["set-cookie"] || "";

      var sessionId = Utilities.getUuid();
      var props = PropertiesService.getScriptProperties();
      props.setProperty("sc_" + sessionId, allCookies);
      props.setProperty("sc_ts_" + sessionId, String(new Date().getTime()));

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        sessionId: sessionId,
        responseCode: loginResponse.getResponseCode()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "proxyLogout") {
      var sid = data.sessionId;
      if (sid) {
        var p = PropertiesService.getScriptProperties();
        p.deleteProperty("sc_" + sid);
        p.deleteProperty("sc_ts_" + sid);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "proxyFetch") {
      var targetUrl = data.targetUrl;
      var method = data.method || "GET";
      var reqHeaders = data.headers || {};
      var payload = data.body || null;
      var sessionId = data.sessionId || null;

      if (sessionId) {
        var props = PropertiesService.getScriptProperties();
        var storedCookies = props.getProperty("sc_" + sessionId);
        if (storedCookies) reqHeaders["Cookie"] = storedCookies;
      }

      var opts = { method: method, headers: reqHeaders, muteHttpExceptions: true };
      if (payload) { opts.payload = payload; }
      var gasResponse = UrlFetchApp.fetch(targetUrl, opts);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        body: gasResponse.getContentText(),
        responseCode: gasResponse.getResponseCode(),
        headers: gasResponse.getHeaders()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                      </pre>
                    </details>
                  </div>
              </div>

              {/* CATÁLOGOS EN LÍNEA (unified section) */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                <div className="border-b border-slate-100 pb-3 font-sans">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" />
                    Búsqueda en catálogos en línea
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Configura supermercados para buscar precios. Cada catálogo puede tener un enlace directo (para abrir en el navegador),
                    una API (para búsqueda programática JSON) o scraping web (para extraer HTML). Tú eliges el método por catálogo.
                  </p>
                </div>

                <CatalogSourceForm
                  initialData={editingCatalogSource}
                  interpretingId={interpretingSourceId}
                  onSave={handleSaveCatalogSource}
                  onDelete={handleDeleteCatalogSource}
                  onCancel={() => setEditingCatalogSource(null)}
                  onInterpret={handleInterpretCatalogSource}
                />

                {/* Sources List */}
                <div className="space-y-2 font-sans">
                  <h4 className="text-xs font-bold text-slate-700">Catálogos configurados ({catalogSources.length})</h4>
                  {catalogSources.length === 0 ? (
                    <p className="text-xs italic text-slate-400">No hay catálogos configurados. Agrega uno usando el formulario de arriba.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {catalogSources.map((s) => (
                        <div key={s.id} className="bg-white p-3 rounded-xl border border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1 max-w-md">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${s.siteSearchEnabled ? "bg-sky-500" : "bg-slate-300"}`} />
                              {s.name}
                              {s.searchMethod === "api" && <span className="text-[9px] text-emerald-600 font-normal bg-emerald-50 px-1.5 py-0.5 rounded">API</span>}
                              {s.searchMethod === "scrape" && <span className="text-[9px] text-sky-600 font-normal bg-sky-50 px-1.5 py-0.5 rounded">Scrape</span>}
                              {s.searchMethod === "none" && <span className="text-[9px] text-slate-400 font-normal">solo enlace</span>}
                            </span>
                            {s.description && <p className="text-[10px] text-slate-500">{s.description}</p>}
                            {s.searchUrlTemplate && (
                              <span className="text-[9px] block text-slate-400 truncate max-w-xs md:max-w-lg font-mono">
                                {s.searchUrlTemplate}
                              </span>
                            )}
                            {s.searchMethod === "api" && s.apiUrl && (
                              <span className="text-[9px] text-emerald-600 block font-mono truncate max-w-xs md:max-w-lg">
                                API: {s.apiMethod} {s.apiUrl}
                              </span>
                            )}
                            {s.searchMethod === "scrape" && (
                              <span className="text-[9px] text-sky-600 block">Scraping web activo</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                            <button onClick={() => setEditingCatalogSource(s)}
                              className="bg-slate-100 hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] transition flex items-center gap-1">
                              Editar
                            </button>
                            <button onClick={() => handleTestCatalogSource(s)} disabled={testingSourceId === s.id}
                              className="bg-slate-100 hover:bg-amber-50 text-amber-700 hover:text-amber-800 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] transition flex items-center gap-1 disabled:opacity-50">
                              {testingSourceId === s.id ? "Probando..." : "Probar"}
                            </button>
                            {s.sessionMethod === "form" && !s.sessionId && (
                              <button onClick={() => { setLoginSource(s); setLoginFormData({}); }}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-2.5 py-1.5 rounded-lg border border-rose-200 text-[10px] transition">
                                Iniciar
                              </button>
                            )}
                            {s.sessionMethod === "form" && s.sessionId && (
                              <button onClick={() => handleLogoutCatalogSource(s)}
                                className="bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] transition">
                                Cerrar Sesión
                              </button>
                            )}
                            <button onClick={() => handleDeleteCatalogSource(s.id, s.name)}
                              className="text-rose-500 hover:text-rose-600 font-bold bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-100 transition"
                              title="Eliminar">
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {testResult && (
                  <div className="bg-slate-900 text-slate-200 p-3 rounded-xl border border-slate-700 font-mono text-[10px] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                        Respuesta Raw (test: "arroz") {testResult.method === "scrape" ? "- HTML Limpiado" : "- JSON"}
                      </span>
                      <button onClick={() => setTestResult(null)} className="text-slate-500 hover:text-slate-300 text-[11px]">&times;</button>
                    </div>
                    <div className="flex gap-2 text-[9px]">
                      <span className={`font-bold ${testResult.status >= 200 && testResult.status < 300 ? "text-emerald-400" : "text-rose-400"}`}>
                        HTTP {testResult.status || "SIN CONEXIÓN"}
                      </span>
                      {testResult.body.length > 0 && (
                        <span className="text-slate-500">{testResult.body.length} bytes</span>
                      )}
                    </div>
                    <pre className="text-[9px] text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-slate-950 p-2 rounded border border-slate-800 select-all">
                      {testResult.bodyPreview}
                    </pre>
                  </div>
                )}
              </div>

              {loginSource && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setLoginSource(null)}>
                  <div className="bg-white p-5 rounded-2xl shadow-xl max-w-md w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <h4 className="text-xs font-bold text-slate-800">Iniciar sesión — {loginSource.name}</h4>
                    {loginSource.sessionCaptchaSiteKey && (
                      <p className="text-[9px] text-amber-600 bg-amber-50 p-2 rounded">
                        Este sitio requiere resolver un captcha. Ábralo en una pestaña separada, resuélvalo y pegue el token.
                      </p>
                    )}
                    {loginSource.sessionLoginFields && Object.keys(loginSource.sessionLoginFields).map((key) => {
                      const tmpl = loginSource.sessionLoginFields![key];
                      const placeholders = [...tmpl.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
                      const fieldLabel = placeholders.join(", ") || key;
                      return (
                        <div key={key}>
                          <label className="block text-[10px] text-slate-600 font-semibold mb-1">{fieldLabel}</label>
                          <input placeholder={fieldLabel}
                            value={loginFormData[fieldLabel] || ""}
                            onChange={(e) => setLoginFormData(d => ({ ...d, [fieldLabel]: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:border-rose-500 focus:outline-none" />
                        </div>
                      );
                    })}
                    {loginSource.sessionCaptchaSiteKey && (
                      <div>
                        <label className="block text-[10px] text-slate-600 font-semibold mb-1">Token reCAPTCHA</label>
                        <input placeholder="Pegue el token aquí"
                          value={loginFormData["__captcha__"] || ""}
                          onChange={(e) => setLoginFormData(d => ({ ...d, ["__captcha__"]: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono focus:border-rose-500 focus:outline-none" />
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => {
                        handleLoginCatalogSource(loginSource, loginFormData, loginFormData["__captcha__"]);
                        setLoginSource(null);
                      }} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition">
                        Iniciar Sesión
                      </button>
                      <button onClick={() => setLoginSource(null)}
                        className="text-slate-500 hover:text-slate-700 font-semibold bg-slate-100 hover:bg-slate-200 py-2 px-4 rounded-xl text-xs transition">
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <StoreAnalyzerWizard
                apiKey={apiKey}
                onAcceptAnalysis={handleAcceptWizardAnalysis}
              />

              {/* Almacenamiento Local y Backups */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4 font-sans">
                <h3 className="text-base font-bold text-slate-800">Almacenamiento Local y Backups</h3>
                <p className="text-xs text-slate-500">
                  Administre el catálogo almacenado en la memoria segura del navegador, exporte hojas de cálculo compatibles con Excel o cargue datos simulados para probar la visualización de gráficos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  
                  {/* Export Google Sheets */}
                  <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between items-start bg-slate-50/30">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        Exportar a Google Sheets (CSV)
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        Crea una planilla estructurada con unidades normalizadas para importar y editar directamente en Google Drive.
                      </p>
                    </div>
                    <button
                      onClick={handleExportCSV}
                      disabled={products.length === 0}
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold px-3 py-2 rounded-lg text-xs transition flex items-center gap-1.5 active:scale-95 shadow"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar CSV
                    </button>
                  </div>

                  {/* Import CSV */}
                  <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between items-start bg-slate-50/30">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Upload className="w-4 h-4 text-sky-600" />
                        Importar desde CSV
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        Cargá un archivo CSV exportado previamente para restaurar productos en el catálogo.
                      </p>
                    </div>
                    <label className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-3 py-2 rounded-lg text-xs transition flex items-center gap-1.5 active:scale-95 shadow cursor-pointer text-center w-full">
                      <Upload className="w-3.5 h-3.5" />
                      Seleccionar archivo CSV
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            try {
                              const csv = ev.target?.result as string;
                              const parsed = parseCSV(csv);
                              if (parsed.length === 0) {
                                triggerError("No se encontraron productos válidos en el CSV.");
                                return;
                              }
                              parsed.forEach(p => {
                                db.saveProduct({
                                  ...p,
                                  id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                  dateExtracted: new Date().toISOString(),
                                });
                              });
                              setProducts(db.getProducts());
                              triggerSuccess(`${parsed.length} productos importados del CSV.`);
                            } catch (err: any) {
                              triggerError(`Error al leer el CSV: ${err.message}`);
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                </div>

                <div className="pt-4 border-t border-slate-100 mt-2 flex justify-between items-center text-xs text-slate-500 flex-wrap gap-2">
                  <div>
                    <span>Registros en base de datos: <strong className="text-slate-700">{products.length} Ofertas indexadas</strong></span>
                  </div>
                  <button
                    onClick={handleClearDb}
                    className="text-rose-500 hover:text-rose-700 font-bold hover:bg-rose-50 px-2 py-1.5 rounded-lg border border-transparent hover:border-rose-100 transition text-[11px]"
                  >
                    Vaciar Base de Datos y Reiniciar App
                  </button>
                </div>

              </div>

              {/* Developer credentials warning disclaimer */}
              <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 mb-1">GH Pages Deployment Note</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  This application was coded intentionally as a client-side layout for seamless integration with GitHub Pages. To execute brochures, users provide their Gemini developer key locally. No server components are required, preventing data leakage risks.
                </p>
              </div>

            </motion.div>
          )}

        </AnimatePresence>

      </main>

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ""}
        message={confirmDialog?.message || ""}
        variant={confirmDialog?.variant || "default"}
        confirmLabel={confirmDialog?.confirmLabel}
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
