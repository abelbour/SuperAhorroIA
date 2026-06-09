/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Receipt as ReceiptIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, ShoppingListItem, BroshureUpload, CustomSearchUrl, Receipt, ReceiptItem } from "./types";
import { db } from "./db";
import {
  getUnitNormalization,
  formatUnitPrice,
  convertToCSV,
  presetOnlineStores,
  findSimilarOnlineProducts
} from "./utils";
import { 
  parseBrochureWithGemini, 
  normalizeExtractedItems, 
  ParseResult,
  scanSinglePriceWithGemini,
  SinglePriceScanResult,
  interpretSearchUrlWithGemini,
  parseReceiptWithGemini,
  ReceiptParseResult,
  suggestShoppingListWithGemini,
  ShoppingListSuggestion
} from "./gemini";

export default function App() {
  // Shared States
  const [products, setProducts] = useState<Product[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [uploads, setUploads] = useState<BroshureUpload[]>([]);
  const [apiKey, setApiKey] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(db.getSelectedModel());
  const [discoveredModels, setDiscoveredModels] = useState<Array<{name: string, displayName: string}>>(db.getDiscoveredModels());
  const [isUpdatingModels, setIsUpdatingModels] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"home" | "upload" | "catalog" | "shopping" | "settings" | "scan" | "receipts">("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Custom Supermarket Catalog Search Engines
  const [customSearchUrls, setCustomSearchUrls] = useState<CustomSearchUrl[]>([]);
  const [newSearchUrlName, setNewSearchUrlName] = useState<string>("");
  const [newSearchUrlTemplate, setNewSearchUrlTemplate] = useState<string>("");
  const [newSearchUrlDesc, setNewSearchUrlDesc] = useState<string>("");
  const [interpretingUrlId, setInterpretingUrlId] = useState<string | null>(null);
  const [interpretingError, setInterpretingError] = useState<string | null>(null);

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
  const [customItemSupermarket, setCustomItemSupermarket] = useState<string>("Manual Store");
  const [customItemAmount, setCustomItemAmount] = useState<string>("1");
  const [customItemUnit, setCustomItemUnit] = useState<string>("unit");

  // PWA Support
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);

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
        custom_search_urls: JSON.stringify(db.getCustomSearchUrls())
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

        db.clearAllProducts();
        db.saveProducts(mergedProducts);
        mergedReceipts.forEach(r => db.saveReceipt(r));

        setProducts(mergedProducts);
        setReceipts(mergedReceipts);

        // Parse configurations if loaded from sheets
        if (json.configs) {
          const cfg = json.configs;
          if (cfg.gemini_api_key) {
            db.saveApiKey(cfg.gemini_api_key);
            setApiKey(cfg.gemini_api_key);
          }
          if (cfg.custom_search_urls) {
            try {
              const urls = JSON.parse(cfg.custom_search_urls);
              if (Array.isArray(urls)) {
                urls.forEach(u => db.saveCustomSearchUrl(u));
                setCustomSearchUrls(db.getCustomSearchUrls());
              }
            } catch (err) {
              console.error("Failed to parse custom_search_urls from gsheets", err);
            }
          }
        }

        const postData = {
          action: "syncAll",
          ssid: ssid,
          products: mergedProducts,
          receipts: mergedReceipts,
          configs: {
            gemini_api_key: db.getApiKey(),
            custom_search_urls: JSON.stringify(db.getCustomSearchUrls())
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
        let msg = "¡Enlace de sincronización copiado a la papelera!";
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
  const getLastPurchaseInfo = (itemName: string) => {
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
  };

  // Searches for active promotional offers from:
  // 1. Uploaded flyers (sourceType === "brochure")
  // 2. Online store catalogs (preset catalogs inside findSimilarOnlineProducts)
  const getBestAvailableOffer = (itemName: string, category: string) => {
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

    // Support preset catalogs (preloaded online supermarket items)
    const onlinePresets = findSimilarOnlineProducts(itemName, category || "Other");
    onlinePresets.forEach((o: any) => {
      if (!allOffers.some(of => of.supermarket === o.storeName && of.price === o.price)) {
        allOffers.push({
          supermarket: o.storeName,
          price: o.price,
          name: o.productName,
          sourceType: "online_preset"
        });
      }
    });

    if (allOffers.length === 0) return null;

    // Pick the absolute cheapest offer
    return allOffers.sort((a, b) => a.price - b.price)[0];
  };

  // Load all records on boot
  useEffect(() => {
    setProducts(db.getProducts());
    setShoppingList(db.getShoppingList());
    setUploads(db.getUploads());
    setApiKey(db.getApiKey());
    setReceipts(db.getReceipts());
    setCustomSearchUrls(db.getCustomSearchUrls());

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

    // Fetch and auto-merge presets from developer standard JSON file
    fetch(`${import.meta.env.BASE_URL}supermarkets.json`)
      .then((res) => {
        if (!res.ok) throw new Error("No supermarkets.json presets found");
        return res.json();
      })
      .then((jsonPresets: CustomSearchUrl[]) => {
        if (jsonPresets && Array.isArray(jsonPresets)) {
          const currentList = db.getCustomSearchUrls();
          let updated = [...currentList];
          let hasChanges = false;
          jsonPresets.forEach((preset) => {
            const itemExists = currentList.some(
              (urlItem) => urlItem.id === preset.id || urlItem.urlTemplate === preset.urlTemplate
            );
            if (!itemExists) {
              updated.push(preset);
              db.saveCustomSearchUrl(preset);
              hasChanges = true;
            }
          });
          if (hasChanges) {
            setCustomSearchUrls(updated);
          }
        }
      })
      .catch((err) => console.log("Standard presets load info:", err));

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
  useEffect(() => {
    if (activeTab !== "scan") {
      stopCamera();
    }
  }, [activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    setScannedItem(null);
    setScanCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      // Wait a tick for DOM video element to exist
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(`Could not access camera: ${err.message || err}. You can also use the manual upload button option below to scan an image of a price label.`);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhotoAndScan = async () => {
    if (!videoRef.current || !cameraStream) {
      triggerError("Camera is not live. Let's start the camera first.");
      return;
    }
    if (!apiKey) {
      triggerError("Gemini API Key is required. Please set it in Settings.");
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

      // Stop camera feed
      stopCamera();

      // Call Gemini for smart label extraction
      const result = await scanSinglePriceWithGemini(base64Data, "image/jpeg", apiKey);
      setScannedItem(result);
      triggerSuccess(`Scanned: ${result.productName} at $${result.price}`);
    } catch (err: any) {
      console.error("Snapshot analysis failure:", err);
      setCameraError(`Failed to parse target price card: ${err.message || err}`);
    } finally {
      setIsCurrentlyScanning(false);
    }
  };

  const handleScanFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    if (!apiKey) {
      triggerError("Gemini API Key is required inside settings to scan!");
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
      triggerSuccess(`Scanned Product: ${result.productName} for $${result.price}`);
    } catch (err: any) {
      console.error("Uploaded file analysis failed:", err);
      setCameraError(`Failed to parse file tag: ${err.message || err}`);
    } finally {
      setIsCurrentlyScanning(false);
    }
  };

  const addScannedToCatalog = () => {
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
      supermarket: scannedItem.supermarket || "Scanned Store",
      dateExtracted: new Date().toISOString(),
      unitPrice: scannedItem.price * norm.multiplier,
      baseUnit: norm.baseUnit,
      description: scannedItem.description || "Captured via smart camera scan scanner",
      sourceType: "manual"
    };

    db.saveProduct(newProduct);
    setProducts(db.getProducts());
    triggerSuccess(`Added ${scannedItem.productName} to comparison database!`);
    
    // reset scanner view
    setScannedItem(null);
    setScanCapturedImage(null);
  };

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
    db.deleteReceipt(id);
    setReceipts(db.getReceipts());
    triggerSuccess("Compra eliminada del historial.");
  };

  const handleGenerateLocalSuggestions = () => {
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
  };

  const handleGenerateAISuggestions = async () => {
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
  };

  const handleAddSuggestedToShopping = (suggestion: ShoppingListSuggestion) => {
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
  };

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

  // Flash warning helper
  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 6000);
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Seed realistic grocery catalog brochures history to test Price History right away!
  const loadDemoData = () => {
    const demoUploads: BroshureUpload[] = [
      {
        id: "demo-upload-1",
        fileName: "march-super-deals.pdf",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
        status: "completed",
        itemCount: 6,
      },
      {
        id: "demo-upload-2",
        fileName: "april-weekly-circular.pdf",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days ago
        status: "completed",
        itemCount: 6,
      },
      {
        id: "demo-upload-3",
        fileName: "may-weekly-circular.pdf",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        status: "completed",
        itemCount: 6,
      },
      {
        id: "demo-upload-4",
        fileName: "aldis-deals.pdf",
        supermarket: "Aldi Market",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        status: "completed",
        itemCount: 5,
      }
    ];

    // Build timeline details for key items
    const demoProducts: Product[] = [
      // Bananas - Safeway Price Trend
      {
        id: "p1-safeway-dt1",
        name: "Organic Bananas",
        category: "Produce",
        originalPrice: 2.20,
        salePrice: 1.99,
        amount: 1,
        unit: "kg",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Fresh premium Cavendish",
        unitPrice: 1.99,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p1-safeway-dt2",
        name: "Organic Bananas",
        category: "Produce",
        originalPrice: 2.20,
        salePrice: 1.79,
        amount: 1,
        unit: "kg",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Fresh premium Cavendish",
        unitPrice: 1.79,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p1-safeway-dt3",
        name: "Organic Bananas",
        category: "Produce",
        originalPrice: 2.20,
        salePrice: 1.65,
        amount: 1,
        unit: "kg",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Fresh premium Cavendish - Lowest yet!",
        unitPrice: 1.65,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      // Bananas - Aldi Market
      {
        id: "p1-aldi-dt1",
        name: "Organic Bananas",
        category: "Produce",
        originalPrice: 1.99,
        salePrice: 1.99,
        amount: 1,
        unit: "kg",
        supermarket: "Aldi Market",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Aldi Savers organic bunch",
        unitPrice: 1.99,
        baseUnit: "kg",
        sourceType: "brochure"
      },

      // Whole Milk - Safeway Foods Trend
      {
        id: "p2-safeway-dt1",
        name: "Whole Milk 1 Gallon",
        category: "Dairy",
        originalPrice: 4.20,
        salePrice: 3.99,
        amount: 1,
        unit: "gal",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Safeway Lucerne Creamy",
        unitPrice: 3.99,
        baseUnit: "L",
        sourceType: "brochure"
      },
      {
        id: "p2-safeway-dt2",
        name: "Whole Milk 1 Gallon",
        category: "Dairy",
        originalPrice: 4.20,
        salePrice: 3.79,
        amount: 1,
        unit: "gal",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 3.79,
        baseUnit: "L",
        sourceType: "brochure"
      },
      {
        id: "p2-safeway-dt3",
        name: "Whole Milk 1 Gallon",
        category: "Dairy",
        originalPrice: 4.20,
        salePrice: 3.49,
        amount: 1,
        unit: "gal",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 3.49,
        baseUnit: "L",
        sourceType: "brochure"
      },
      // Whole Milk - Aldi Market
      {
        id: "p2-aldi-dt1",
        name: "Whole Milk 1 Gallon",
        category: "Dairy",
        originalPrice: 3.39,
        salePrice: 3.39,
        amount: 1,
        unit: "gal",
        supermarket: "Aldi Market",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Friendly Farms Grade A Milk",
        unitPrice: 3.39,
        baseUnit: "L",
        sourceType: "brochure"
      },

      // Greek Yogurt
      {
        id: "p3-safeway-dt1",
        name: "Greek Yogurt 500g",
        category: "Dairy",
        originalPrice: 4.99,
        salePrice: 4.50,
        amount: 500,
        unit: "g",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 9.0, // per kg
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p3-safeway-dt2",
        name: "Greek Yogurt 500g",
        category: "Dairy",
        originalPrice: 4.99,
        salePrice: 4.25,
        amount: 500,
        unit: "g",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 8.5,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p3-aldi-dt1",
        name: "Greek Yogurt 500g",
        category: "Dairy",
        originalPrice: 4.10,
        salePrice: 3.89,
        amount: 500,
        unit: "g",
        supermarket: "Aldi Market",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Chobani Plain Nonfat",
        unitPrice: 7.78,
        baseUnit: "kg",
        sourceType: "brochure"
      },

      // Boneless Chicken Breast
      {
        id: "p4-safeway-dt1",
        name: "Boneless Chicken Breast",
        category: "Meat",
        originalPrice: 10.99,
        salePrice: 9.49,
        amount: 1,
        unit: "kg",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 9.49,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p4-safeway-dt2",
        name: "Boneless Chicken Breast",
        category: "Meat",
        originalPrice: 10.99,
        salePrice: 8.49,
        amount: 1,
        unit: "kg",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 8.49,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p4-aldi-dt1",
        name: "Boneless Chicken Breast 1kg",
        category: "Meat",
        originalPrice: 8.99,
        salePrice: 8.49,
        amount: 1,
        unit: "kg",
        supermarket: "Aldi Market",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Fresh premium hormone-free",
        unitPrice: 8.49,
        baseUnit: "kg",
        sourceType: "brochure"
      },

      // Fresh Strawberries
      {
        id: "p5-safeway-dt1",
        name: "Fresh Strawberries 454g",
        category: "Produce",
        originalPrice: 4.49,
        salePrice: 3.99,
        amount: 454,
        unit: "g",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 8.78,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p5-safeway-dt2",
        name: "Fresh Strawberries 454g",
        category: "Produce",
        originalPrice: 4.49,
        salePrice: 3.49,
        amount: 454,
        unit: "g",
        supermarket: "Safeway Foods",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 7.68,
        baseUnit: "kg",
        sourceType: "brochure"
      },
      {
        id: "p5-aldi-dt1",
        name: "Fresh Strawberries 500g",
        category: "Produce",
        originalPrice: 4.50,
        salePrice: 3.59,
        amount: 500,
        unit: "g",
        supermarket: "Aldi Market",
        dateExtracted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        unitPrice: 7.18,
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
    triggerSuccess("Loaded high-quality grocery demo data! Ready for instant price comparison & trends.");
  };

  // Reset database completely
  const handleClearDb = () => {
    if (confirm("Are you sure you want to clear all extracted brochure data and reset?")) {
      db.clearAllProducts();
      db.clearShoppingList();
      localStorage.removeItem("bp_uploads");
      
      setProducts([]);
      setShoppingList([]);
      setUploads([]);
      triggerSuccess("Database successfully wiped.");
    }
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
      triggerError("Please select or drop a brochure PDF or Image file first.");
      return;
    }
    if (!apiKey) {
      triggerError("Gemini API Key is required. Please add your key in Settings.");
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
      const parsedItems = normalizeExtractedItems(rawResult, "brochure");

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

      triggerSuccess(`AI successfully parsed brochure sheet! Review the items below.`);
    } catch (err: any) {
      console.error(err);
      const failedUpload: BroshureUpload = {
        ...initialUpload,
        supermarket: manualSupermarket || "Unknown",
        status: "failed",
        itemCount: 0,
        errorMessage: err.message || "Failed to parse PDF brochure file",
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
    if (confirm("Discard these extracted items?")) {
      setExtractedPreview(null);
      setManualSupermarket("");
    }
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

  // Helper file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const baseString = reader.result as string;
        resolve(baseString.split(",")[1]);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  // List of unique supermarkets in catalog
  const uniqueSupermarkets = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => { if (p.supermarket) list.add(p.supermarket); });
    return Array.from(list);
  }, [products]);

  // Handle Manual addition of product to catalog
  const addManualProduct = (e: React.FormEvent) => {
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
      supermarket: customItemSupermarket.trim() || "Manual Store",
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

    triggerSuccess(`Successfully added manual catalog reference.`);
  };

  // Remove individual catalog product
  const deleteProduct = (id: string) => {
    if (confirm("Are you sure you want to delete this listing from database?")) {
      db.deleteProduct(id);
      setProducts(db.getProducts());
      if (selectedCompareProduct?.id === id) {
        setSelectedCompareProduct(null);
      }
      triggerSuccess("Product deleted.");
    }
  };

  // Add Item to Shopping List
  const addToShoppingList = (product: Product) => {
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
    triggerSuccess(`Added ${product.name} to shopping list.`);
  };

  // Modify quantities on active shopping list
  const updateListItemQuantity = (id: string, qty: number) => {
    const item = shoppingList.find(l => l.id === id);
    if (!item) return;

    if (qty <= 0) {
      db.deleteShoppingListItem(id);
    } else {
      db.saveShoppingListItem({ ...item, quantity: qty });
    }
    setShoppingList(db.getShoppingList());
  };

  const toggleListItemChecked = (id: string) => {
    const item = shoppingList.find(l => l.id === id);
    if (!item) return;
    db.saveShoppingListItem({ ...item, checked: !item.checked });
    setShoppingList(db.getShoppingList());
  };

  const deleteListItem = (id: string) => {
    db.deleteShoppingListItem(id);
    setShoppingList(db.getShoppingList());
  };

  const clearList = () => {
    if (confirm("Clear your entire shopping list?")) {
      db.clearShoppingList();
      setShoppingList([]);
    }
  };

  // Master catalog filtration and sort application
  const filteredProducts = useMemo(() => {
    // We only want the LATEST listing per product per supermarket for general catalog view,
    // to map distinct products.
    const latestItemsMap: { [key: string]: Product } = {};
    
    products.forEach(p => {
      // create a composite key to group by name and supermarket
      const key = `${p.name.toLowerCase().trim()}_${p.supermarket.toLowerCase().trim()}`;
      const existing = latestItemsMap[key];
      if (!existing || new Date(p.dateExtracted) > new Date(existing.dateExtracted)) {
        latestItemsMap[key] = p;
      }
    });

    let list = Object.values(latestItemsMap);

    // Apply text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q) ||
        p.supermarket.toLowerCase().includes(q)
      );
    }

    // Apply categories
    if (categoryFilter !== "All") {
      list = list.filter(p => p.category === categoryFilter);
    }

    // Apply supermarket filters
    if (supermarketFilter !== "All") {
      list = list.filter(p => p.supermarket === supermarketFilter);
    }

    // Apply Sorts
    list.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "price_asc") {
        return a.salePrice - b.salePrice;
      }
      if (sortBy === "price_desc") {
        return b.salePrice - a.salePrice;
      }
      if (sortBy === "unitprice_asc") {
        return a.unitPrice - b.unitPrice;
      }
      return 0;
    });

    return list;
  }, [products, searchQuery, categoryFilter, supermarketFilter, sortBy]);

  // Aggregate Price History for a specific product
  const productPriceHistory = useMemo(() => {
    if (!selectedCompareProduct) return [];

    const pName = selectedCompareProduct.name.toLowerCase().trim();
    
    // Find all records with this exact/similar name
    const matches = products.filter(p => p.name.toLowerCase().trim() === pName);

    // Group by date and sort safely
    return matches.map(m => ({
      date: new Date(m.dateExtracted).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}),
      timestamp: new Date(m.dateExtracted).getTime(),
      price: m.salePrice,
      unitPrice: m.unitPrice,
      supermarket: m.supermarket,
    })).sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedCompareProduct, products]);

  // Online store catalog comparisons for the currently selected detail item
  const catalogComparisons = useMemo(() => {
    if (!selectedCompareProduct) return [];
    return findSimilarOnlineProducts(selectedCompareProduct.name, selectedCompareProduct.category);
  }, [selectedCompareProduct]);

  // Global shopping budget optimizer calculations
  const shoppingOptimization = useMemo(() => {
    if (shoppingList.length === 0) return null;

    // We want to calculate:
    // 1. Total cost if we buy everything at Supermarket X
    // 2. Best combined option (buying each item where it is absolute cheapest)
    const supermarketsRepresented = Array.from(new Set([
      ...uniqueSupermarkets,
      ...presetOnlineStores.map(s => s.name)
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
      
      // Look up prices in online catalogs for this item
      const onlineMatches = findSimilarOnlineProducts(item.name, item.category);

      // Collate all known prices for this product name
      const priceBook: { [market: string]: number } = { [item.supermarket]: item.price };
      
      localMatches.forEach(match => {
        // Only keep cheapest per supermarket
        if (!priceBook[match.supermarket] || match.salePrice < priceBook[match.supermarket]) {
          priceBook[match.supermarket] = match.salePrice;
        }
      });

      onlineMatches.forEach(match => {
        if (!priceBook[match.storeName] || match.price < priceBook[match.storeName]) {
          priceBook[match.storeName] = match.price;
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
  const handleExportCSV = () => {
    if (products.length === 0) {
      triggerError("No data available to export. Standardize some brochures first.");
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
    triggerSuccess("CSV catalog exported. You can import this directly into Google Sheets!");
  };

  // Custom Supermarket Search Engines Actions
  const handleSaveSearchUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSearchUrlName.trim() || !newSearchUrlTemplate.trim()) {
      triggerError("Por favor, ingrese un nombre y una plantilla de URL.");
      return;
    }

    const id = `url-${Date.now()}`;
    const newEngine: CustomSearchUrl = {
      id,
      name: newSearchUrlName,
      urlTemplate: newSearchUrlTemplate,
      description: newSearchUrlDesc || "Buscador personalizado ingresado por el usuario."
    };

    db.saveCustomSearchUrl(newEngine);
    setCustomSearchUrls(db.getCustomSearchUrls());
    setNewSearchUrlName("");
    setNewSearchUrlTemplate("");
    setNewSearchUrlDesc("");
    triggerSuccess(`Buscador "${newEngine.name}" guardado con éxito.`);
  };

  const handleDeleteSearchUrl = (id: string, name: string) => {
    db.deleteCustomSearchUrl(id);
    setCustomSearchUrls(db.getCustomSearchUrls());
    triggerSuccess(`Buscador "${name}" eliminado.`);
  };

  const handleInterpretSearchUrl = async (urlItem: CustomSearchUrl) => {
    if (!apiKey) {
      triggerError("Falta la clave API de Gemini. Configúrela primero en la sección de Ajustes.");
      return;
    }
    setInterpretingUrlId(urlItem.id);
    setInterpretingError(null);
    try {
      const result = await interpretSearchUrlWithGemini(urlItem.name, urlItem.urlTemplate, apiKey);
      const updated: CustomSearchUrl = {
        ...urlItem,
        urlTemplate: result.urlTemplate,
        aiInterpretation: `💡 **Análisis de IA:** ${result.aiExplanation}\n\n🏷️ **Tips de Ahorro:** ${result.tipsForUser}`
      };
      db.saveCustomSearchUrl(updated);
      setCustomSearchUrls(db.getCustomSearchUrls());
      triggerSuccess(`¡IA interpretó correctamente el buscador de "${urlItem.name}"!`);
    } catch (err: any) {
      console.error(err);
      setInterpretingError(err.message || "Error al interpretar.");
      triggerError("No se pudo interpretar el buscador con IA.");
    } finally {
      setInterpretingUrlId(null);
    }
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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 overflow-x-hidden">
      
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
                <p className="font-semibold text-sm">Action Requirement</p>
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
                <p className="font-semibold text-sm">Success</p>
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
                    <span>Impulsado con Gemini 3.5 AI</span>
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
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-98 shadow-sm cursor-pointer"
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
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-98 shadow-sm cursor-pointer"
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
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-violet-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-98 shadow-sm cursor-pointer"
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
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-rose-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-98 shadow-sm cursor-pointer"
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
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-amber-200 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-98 shadow-sm cursor-pointer"
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
                    className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between group active:scale-98 shadow-sm cursor-pointer"
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

              {/* Botón rápido para restaurar o cargar datos falsos para onboardear */}
              {products.length === 0 && (
                <div className="mt-4 p-5 bg-sky-50 rounded-2xl border border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="font-bold text-slate-800 text-sm">¿Deseas probar la aplicación de inmediato?</p>
                    <p className="text-xs text-slate-600">Carga un lote completo de productos falsos y de simulación para ver cómo operan los filtros y comparativas del planificador.</p>
                  </div>
                  <button
                    onClick={loadDemoData}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition shadow cursor-pointer shrink-0"
                  >
                    Cargar Datos de Simulación
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 1: CATALOG OF PRODUCTS */}
          {activeTab === "catalog" && (
            <motion.div
              key="catalog-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              
              {/* Warnings / Onboarding callout when empty */}
              {products.length === 0 && (
                <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 rounded-2xl p-6 md:p-8 text-center max-w-2xl mx-auto my-8">
                  <Store className="w-12 h-12 text-sky-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-800">Your Product Comparison Database is Empty</h3>
                  <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
                    To start saving, you can parse a supermarket PDF brochure using Gemini AI, or load high-quality mock data instantly to preview catalog tracking.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={loadDemoData}
                      className="bg-white hover:bg-slate-50 text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition active:scale-95 text-sm"
                    >
                      Load Realistic Test Data
                    </button>
                    <button
                      onClick={() => setActiveTab("upload")}
                      className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-md transition active:scale-95 text-sm flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Brochure PDF
                    </button>
                  </div>
                </div>
              )}

              {products.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Filters and List browser */}
                  <div className="lg:col-span-8 flex flex-col gap-4">
                    
                    {/* Filter bar */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                      
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search products, brands, categories..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:border-sky-500 focus:outline-none"
                        />
                      </div>

                      {/* Dropdowns */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Department Category</label>
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none"
                          >
                            <option value="All">All Departments</option>
                            <option value="Produce">Produce 🍏</option>
                            <option value="Meat">Meat & Seafood 🥩</option>
                            <option value="Dairy">Dairy & Eggs 🥛</option>
                            <option value="Bakery">Bakery 🍞</option>
                            <option value="Pantry">Pantry & Snacks 🍝</option>
                            <option value="Beverages">Beverages 🥤</option>
                            <option value="Household">Household Care 🧼</option>
                            <option value="Other">Other Elements 📦</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Supermarket</label>
                          <select
                            value={supermarketFilter}
                            onChange={(e) => setSupermarketFilter(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none"
                          >
                            <option value="All">All Supermarkets</option>
                            {uniqueSupermarkets.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Sort Catalog By</label>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none"
                          >
                            <option value="name">Product Name (A-Z)</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                            <option value="unitprice_asc">Unit Value: Best Metric</option>
                          </select>
                        </div>
                      </div>

                    </div>

                    {/* Master Results List (Unique Items) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catalog Matches ({filteredProducts.length})</span>
                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">Latest Leaflet Pricing</span>
                      </div>

                      <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                        {filteredProducts.map((product) => {
                          const isSelected = selectedCompareProduct?.id === product.id;
                          return (
                            <div 
                              key={product.id}
                              onClick={() => setSelectedCompareProduct(product)}
                              className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition ${
                                isSelected ? "bg-sky-50/70 shadow-inner" : "hover:bg-slate-50/50"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                                    {product.category}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {new Date(product.dateExtracted).toLocaleDateString()}
                                  </span>
                                </div>
                                <h4 className="text-sm font-semibold text-slate-800 mt-1 truncate">{product.name}</h4>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                                  <span className="flex items-center gap-1 font-medium text-slate-700">
                                    <Store className="w-3.5 h-3.5 text-slate-400" />
                                    {product.supermarket}
                                  </span>
                                  <span>•</span>
                                  <span>Pack size: {product.amount} {product.unit}</span>
                                </div>
                              </div>

                              <div className="text-right shrink-0 flex items-center gap-3">
                                <div>
                                  <div className="text-base font-bold text-slate-900">
                                    ${product.salePrice.toFixed(2)}
                                  </div>
                                  {product.originalPrice > product.salePrice && (
                                    <div className="text-[10px] text-rose-500 line-through">
                                      ${product.originalPrice.toFixed(2)}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                    {formatUnitPrice(product.unitPrice, product.baseUnit)}
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1.5 justify-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToShoppingList(product);
                                    }}
                                    className="p-1.5 bg-slate-900 hover:bg-sky-600 hover:text-white text-slate-200 rounded-lg transition active:scale-95"
                                    title="Add to Shopping List"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteProduct(product.id);
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                    title="Delete product match"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {filteredProducts.length === 0 && (
                          <div className="p-8 text-center text-slate-400">
                            No products match your filters. Try modifying terms.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Manual product injector form */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Add Custom Direct Reference Price</h4>
                      <form onSubmit={addManualProduct} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        <div className="col-span-2 sm:col-span-1 md:col-span-2">
                          <input
                            type="text"
                            placeholder="Product Name"
                            value={customItemName}
                            onChange={(e) => setCustomItemName(e.target.value)}
                            className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <select
                            value={customItemCategory}
                            onChange={(e) => setCustomItemCategory(e.target.value)}
                            className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none"
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
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Price ($)"
                            value={customItemPrice}
                            onChange={(e) => setCustomItemPrice(e.target.value)}
                            className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={customItemAmount}
                            onChange={(e) => setCustomItemAmount(e.target.value)}
                            className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Unit"
                            value={customItemUnit}
                            onChange={(e) => setCustomItemUnit(e.target.value)}
                            className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Store Name"
                            value={customItemSupermarket}
                            onChange={(e) => setCustomItemSupermarket(e.target.value)}
                            className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-sky-500 focus:outline-none animate-pulse"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs py-2 rounded-lg transition active:scale-95"
                        >
                          Add Product
                        </button>
                      </form>
                    </div>

                  </div>

                  {/* Right Column: Dynamic Price history analytics of selectedCompareProduct */}
                  <div className="lg:col-span-4 sticky top-28 flex flex-col gap-4">
                    
                    {selectedCompareProduct ? (
                      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                        
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <div>
                            <span className="text-[10px] text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                              {selectedCompareProduct.category}
                            </span>
                            <h3 className="text-base font-bold text-slate-800 mt-1">{selectedCompareProduct.name}</h3>
                          </div>
                          <button 
                            onClick={() => setSelectedCompareProduct(null)}
                            className="text-slate-300 hover:text-slate-500 text-xs font-semibold"
                          >
                            Clear
                          </button>
                        </div>

                        {/* Current metrics */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl mb-4 text-xs">
                          <div>
                            <p className="text-slate-400">Current Price</p>
                            <p className="text-base font-bold text-slate-800 mt-0.5">
                              ${selectedCompareProduct.salePrice.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-slate-400">({selectedCompareProduct.amount} {selectedCompareProduct.unit})</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Unit Price Value</p>
                            <p className="text-base font-bold text-slate-800 mt-0.5 font-mono text-sky-600">
                              {formatUnitPrice(selectedCompareProduct.unitPrice, selectedCompareProduct.baseUnit)}
                            </p>
                            <p className="text-[10px] text-slate-400">Base: {selectedCompareProduct.baseUnit}</p>
                          </div>
                        </div>

                        {/* Price Comparison Graph (Custom SVGs) */}
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
                              Price History Trend
                            </h4>
                            <span className="text-[10px] text-slate-400">Extracted brochures</span>
                          </div>

                          {productPriceHistory.length > 1 ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 h-44 flex flex-col justify-between relative shadow-inner">
                              
                              {/* Draw SVG Graph */}
                              <svg className="w-full h-full pt-4 pb-6 px-4" viewBox="0 0 200 100" preserveAspectRatio="none">
                                {/* Grid-lines */}
                                <line x1="0" y1="20" x2="200" y2="20" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                                <line x1="0" y1="50" x2="200" y2="50" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                                <line x1="0" y1="80" x2="200" y2="80" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />

                                {(() => {
                                  // Map rates to relative coordinates (0 to 100)
                                  const prices = productPriceHistory.map(h => h.price);
                                  const minP = Math.min(...prices) * 0.9;
                                  const maxP = Math.max(...prices) * 1.1;
                                  const range = maxP - minP || 1;

                                  const points = productPriceHistory.map((h, i) => {
                                    const x = (i / (productPriceHistory.length - 1)) * 200;
                                    // Invert Y axes so higher prices load at top
                                    const y = 90 - ((h.price - minP) / range) * 80;
                                    return { x, y, info: h };
                                  });

                                  // Join lines
                                  const d = points.reduce((path, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`, "");

                                  return (
                                    <>
                                      {/* Gradient Area Fill under Graph */}
                                      <path
                                        d={`${d} L ${points[points.length-1].x} 90 L ${points[0].x} 90 Z`}
                                        fill="url(#trendGrad)"
                                        opacity="0.15"
                                      />
                                      <defs>
                                        <linearGradient id="trendGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                          <stop offset="0%" stopColor="#38bdf8" />
                                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                                        </linearGradient>
                                      </defs>

                                      {/* Main Trend Line path */}
                                      <path d={d} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />

                                      {/* Dot points */}
                                      {points.map((p, idx) => (
                                        <g key={idx}>
                                          <circle cx={p.x} cy={p.y} r="2.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                                          <text 
                                            x={p.x} 
                                            y={p.y - 6} 
                                            fill="#94a3b8" 
                                            fontSize="5" 
                                            textAnchor="middle"
                                            fontFamily="monospace"
                                          >
                                            ${p.info.price.toFixed(2)}
                                          </text>
                                        </g>
                                      ))}
                                    </>
                                  );
                                })()}
                              </svg>

                              {/* Axes date tags at bottom */}
                              <div className="absolute bottom-1 left-3 right-3 flex justify-between text-[8px] text-slate-500 font-mono">
                                <span>{productPriceHistory[0].date}</span>
                                {productPriceHistory.length > 2 && (
                                  <span>{productPriceHistory[Math.floor(productPriceHistory.length / 2)].date}</span>
                                )}
                                <span>{productPriceHistory[productPriceHistory.length - 1].date}</span>
                              </div>

                            </div>
                          ) : (
                            <div className="bg-slate-50 rounded-xl p-6 text-center text-xs text-slate-400">
                              Requires at least 2 historical scanner listings to plot a price trajectory.
                            </div>
                          )}
                        </div>

                        {/* Online Catalog lookups & price comparison comparison */}
                        <div className="flex-1 mt-2">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-zinc-400" />
                            Digital Catalog Comparison
                          </h4>

                          <div className="flex flex-col gap-2 max-h-[22vh] overflow-y-auto">
                            
                            {/* Selected comparison supermarket first */}
                            <div className="p-2.5 bg-sky-500/10 border border-sky-450 rounded-xl flex justify-between items-center text-xs">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 flex items-center gap-1">
                                  <Store className="w-3 h-3 text-sky-600" />
                                  {selectedCompareProduct.supermarket} (Current)
                                </p>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">{selectedCompareProduct.name}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold text-slate-900">${selectedCompareProduct.salePrice.toFixed(2)}</p>
                                <p className="text-[9px] text-sky-600 font-mono mt-0.5">
                                  {formatUnitPrice(selectedCompareProduct.unitPrice, selectedCompareProduct.baseUnit)}
                                </p>
                              </div>
                            </div>

                            {/* Catalog matches */}
                            {catalogComparisons.map((comp, idx) => {
                              const isCheaper = comp.unitPrice < selectedCompareProduct.unitPrice;
                              const diff = Math.abs(selectedCompareProduct.unitPrice - comp.unitPrice);
                              return (
                                <div key={idx} className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/55 rounded-xl flex justify-between items-center text-xs transition">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-700 flex items-center gap-1">
                                      <Globe className="w-3 h-3 text-slate-400" />
                                      {comp.storeName}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{comp.productName}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="font-bold text-slate-800">${comp.price.toFixed(2)}</p>
                                    <p className={`text-[9px] font-mono mt-0.5 ${isCheaper ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                      {formatUnitPrice(comp.unitPrice, comp.baseUnit)}
                                    </p>
                                    {isCheaper && (
                                      <span className="text-[8px] text-emerald-500 bg-emerald-50 px-1 rounded block mt-0.5">
                                        Cheaper by ${diff.toFixed(2)}/{comp.baseUnit}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {catalogComparisons.length === 0 && (
                              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                                No similar items found in digital catalog catalogs.
                              </div>
                            )}

                          </div>
                          
                          <button
                            onClick={() => addToShoppingList(selectedCompareProduct)}
                            className="w-full mt-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Add to Shopping List
                          </button>

                        </div>

                      </div>
                    ) : (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center py-12 flex flex-col justify-center items-center">
                        <Info className="w-8 h-8 text-slate-300 mb-3" />
                        <h4 className="font-bold text-slate-700 text-sm">No Product Selected</h4>
                        <p className="text-xs text-slate-400 mt-1.5 max-w-[200px]">
                          Click any product listing on the left to show online price comparisons and price trends over time.
                        </p>
                      </div>
                    )}

                  </div>

                </div>
              )}

            </motion.div>
          )}

          {/* TAB: CAMERA SCAN PRICE TAG */}
          {activeTab === "scan" && (
            <motion.div
              key="scan-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto flex flex-col gap-6"
            >
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Escáner de Góndola y Comparador de Precios</h2>
                    <p className="text-xs text-slate-500">Apunte su cámara a una etiqueta de precio en góndola o suba una foto para comparar al instante.</p>
                  </div>
                </div>

                {!apiKey && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">Se requiere Clave API de Gemini</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Para analizar etiquetas de precio en tiempo real con Inteligencia Artificial, necesita configurar una API Key de Gemini en Ajustes.
                      </p>
                      <button
                        onClick={() => setActiveTab("settings")}
                        className="mt-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        Ingresar API Key Ahora
                      </button>
                    </div>
                  </div>
                )}

                {apiKey && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* Panel Izquierdo: Cámara o Imagen subida */}
                    <div className="md:col-span-6 flex flex-col gap-3">
                      <div className="relative bg-slate-900 rounded-2xl aspect-[4/3] overflow-hidden flex flex-col items-center justify-center border border-slate-800 shadow-inner group">
                        
                        {/* Video en vivo */}
                        {isCameraActive && (
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Efecto de láser escáner */}
                        {isCameraActive && !scanCapturedImage && (
                          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                            <div className="w-full h-0.5 bg-emerald-400 absolute top-1/4 animate-[bounce_3s_infinite] shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                            
                            <div className="border-2 border-dashed border-emerald-400/60 w-3/4 h-1/2 rounded-lg flex items-center justify-center relative">
                              <span className="text-[10px] text-emerald-300 font-mono tracking-wider bg-slate-900/80 px-2 py-0.5 rounded uppercase">Alinee el precio aquí</span>
                              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 -mt-0.5 -ml-0.5" />
                              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 -mt-0.5 -mr-0.5" />
                              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 -mb-0.5 -ml-0.5" />
                              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 -mb-0.5 -mr-0.5" />
                            </div>
                          </div>
                        )}

                        {/* Foto fija capturada o subida */}
                        {scanCapturedImage && (
                          <img
                            src={scanCapturedImage}
                            alt="Etiqueta capturada"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        {/* Estado: Cámara apagada */}
                        {!isCameraActive && !scanCapturedImage && !isCurrentlyScanning && (
                          <div className="text-center p-6 flex flex-col items-center">
                            <div className="p-4 bg-slate-800 text-slate-400 rounded-full mb-3">
                              <Camera className="w-8 h-8" />
                            </div>
                            <span className="text-sm font-semibold text-slate-300">Cámara Apagada</span>
                            <span className="text-xs text-slate-500 max-w-xs mt-1">Lista para usarse en su celular o computadora</span>
                          </div>
                        )}

                        {/* Analizando con Gemini */}
                        {isCurrentlyScanning && (
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                            <h4 className="text-sm font-bold text-white tracking-wide">Gemini procesando...</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-xs">Extrayendo texto, identificando moneda, marcas y peso de la etiqueta</p>
                          </div>
                        )}
                      </div>

                      {/* Botones de control */}
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          {!isCameraActive ? (
                            <button
                              onClick={startCamera}
                              disabled={isCurrentlyScanning}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-3 rounded-xl shadow transition active:scale-95 disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
                            >
                              <Camera className="w-4 h-4" />
                              Encender Cámara
                            </button>
                          ) : (
                            <button
                              onClick={stopCamera}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold py-2.5 px-3 rounded-xl transition active:scale-95 text-xs flex items-center justify-center gap-1.5"
                            >
                              Apagar Cámara
                            </button>
                          )}

                          {isCameraActive && (
                            <button
                              onClick={capturePhotoAndScan}
                              disabled={isCurrentlyScanning}
                              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 px-3 rounded-xl shadow transition active:scale-95 disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
                            >
                              <ScanLine className="w-4 h-4" />
                              Capturar y Comparar
                            </button>
                          )}

                          {scanCapturedImage && (
                            <button
                              onClick={() => {
                                setScannedItem(null);
                                setScanCapturedImage(null);
                                startCamera();
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold py-2.5 px-3 rounded-xl transition active:scale-95 text-xs flex items-center justify-center gap-1.5"
                            >
                              Nueva Captura
                            </button>
                          )}
                        </div>

                        {/* Cargar Archivo Opcional */}
                        <div className="relative border border-slate-200 border-dashed rounded-xl p-3 bg-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                             <span className="text-xs text-slate-500 font-medium">¿Sin cámara? Suba una foto:</span>
                          </div>
                          <label className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer shadow-sm transition">
                            Elegir Foto
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleScanFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {cameraError && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{cameraError}</span>
                        </div>
                      )}
                    </div>

                    {/* Panel Derecho: Resultados e Interpretaciones */}
                    <div className="md:col-span-6 flex flex-col gap-4">
                      
                      {!scannedItem && (
                        <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center">
                          <ScanLine className="w-10 h-10 text-slate-300 mb-2 animate-bounce" />
                          <h4 className="text-sm font-semibold text-slate-700">Esperando Captura de Precio</h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-xs">
                            Encienda la cámara y apunte a una etiqueta, o suba una imagen. La IA extraerá los datos y buscaremos mejores precios.
                          </p>
                        </div>
                      )}

                      {scannedItem && (
                        <div className="flex flex-col gap-4">
                          
                          {/* Datos editables extraídos por IA */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col gap-3">
                            <span className="text-[10px] font-bold tracking-widest text-emerald-600 bg-emerald-50 self-start px-2 py-0.5 rounded-full uppercase">Detalles Extraídos por IA</span>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div className="md:col-span-2">
                                <label className="block text-slate-500 font-semibold mb-1">Nombre del Producto</label>
                                <input
                                  type="text"
                                  value={scannedItem.productName}
                                  onChange={(e) => setScannedItem({ ...scannedItem, productName: e.target.value })}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-500 font-semibold mb-1">Precio ($ ARS)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={scannedItem.price}
                                  onChange={(e) => setScannedItem({ ...scannedItem, price: Number(e.target.value) || 0 })}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-500 font-semibold mb-1">Supermercado</label>
                                <input
                                  type="text"
                                  value={scannedItem.supermarket}
                                  onChange={(e) => setScannedItem({ ...scannedItem, supermarket: e.target.value })}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-500 font-semibold mb-1">Cantidad Neto / Contenido</label>
                                <input
                                  type="number"
                                  value={scannedItem.amount}
                                  onChange={(e) => setScannedItem({ ...scannedItem, amount: Number(e.target.value) || 1 })}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-500 font-semibold mb-1">Unidad Medida</label>
                                <select
                                  value={scannedItem.unit}
                                  onChange={(e) => setScannedItem({ ...scannedItem, unit: e.target.value })}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                                >
                                  <option value="unidad">unidades / unidad (u)</option>
                                  <option value="g">gramos (g)</option>
                                  <option value="kg">kilogramos (kg)</option>
                                  <option value="L">litros (L)</option>
                                  <option value="ml">mililitros (ml)</option>
                                  <option value="oz">onzas (oz)</option>
                                  <option value="lb">libras (lb)</option>
                                  <option value="paquetes">paquetes</option>
                                </select>
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-slate-500 font-semibold mb-1">Categoría del Rubro</label>
                                <select
                                  value={scannedItem.category}
                                  onChange={(e) => setScannedItem({ ...scannedItem, category: e.target.value })}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                                >
                                  <option value="Produce">Verdulería y Frutas 🍏</option>
                                  <option value="Meat">Carnes y Pescados 🥩</option>
                                  <option value="Dairy">Lácteos y Huevos 🥛</option>
                                  <option value="Bakery">Panadería 🍞</option>
                                  <option value="Pantry">Almacén y Snacks 🍝</option>
                                  <option value="Beverages">Bebidas 🥤</option>
                                  <option value="Household">Limpieza y Hogar 🧼</option>
                                  <option value="Other">Otros Artículos 📦</option>
                                </select>
                              </div>
                            </div>

                            {/* CORE UNIT PRICE CALCULATION DISPLAY */}
                            {(() => {
                              const norm = getUnitNormalization(scannedItem.amount || 1, scannedItem.unit || "unidad");
                              const scannerUnitPrice = scannedItem.price * norm.multiplier;
                              return (
                                <div className="mt-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-emerald-600 shrink-0" />
                                    <div>
                                      <span className="text-[9px] block font-bold text-emerald-800 uppercase tracking-widest">CÁLCULO DE PRECIO UNITARIO</span>
                                      <span className="text-sm font-extrabold text-emerald-950 font-mono">
                                        {formatUnitPrice(scannerUnitPrice, norm.baseUnit)}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-500/20 px-2 py-0.5 rounded uppercase">Metrificado</span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* COMPARACIONES INTELIGENTES */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                              <TrendingUp className="w-4 h-4 text-sky-500" />
                              Comparativa con Base de Datos
                            </h3>

                            {(() => {
                              const queryStr = scannedItem.productName.toLowerCase();
                              const matchedLocal = products.filter(p => 
                                p.name.toLowerCase().includes(queryStr) || 
                                queryStr.includes(p.name.toLowerCase())
                              );

                              const matchedOnline = findSimilarOnlineProducts(scannedItem.productName, scannedItem.category);

                              const allDeals = [
                                ...matchedLocal.map(p => ({
                                  store: p.supermarket,
                                  price: p.salePrice,
                                  type: "Folleto Digital" as const,
                                  unitDesc: `${p.amount}${p.unit}`,
                                  unitPriceStr: formatUnitPrice(p.unitPrice, p.baseUnit)
                                })),
                                ...matchedOnline.map(o => ({
                                  store: o.storeName,
                                  price: o.price,
                                  type: "Catálogo Online" as const,
                                  unitDesc: `${o.amount}${o.unit}`,
                                  unitPriceStr: formatUnitPrice(o.unitPrice, o.baseUnit)
                                }))
                              ];

                              const currentScannerNorm = getUnitNormalization(scannedItem.amount || 1, scannedItem.unit || "unidad");
                              const currentScannerUnitPrice = scannedItem.price * currentScannerNorm.multiplier;

                              const bestKnownAlternative = allDeals.reduce((best, cur) => {
                                if (cur.price < best.price) return cur;
                                  return best;
                              }, { store: scannedItem.supermarket, price: scannedItem.price, type: "Escaneo Actual", unitDesc: "", unitPriceStr: "" });

                              const isGoodDeal = scannedItem.price <= bestKnownAlternative.price;

                              return (
                                <div className="space-y-3">
                                  {/* Asesor de ofertas */}
                                  <div className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${isGoodDeal ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                                    {isGoodDeal ? (
                                      <>
                                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                          <p className="font-bold">¡Es una excelente oferta! 👍</p>
                                          <p className="text-emerald-700 mt-0.5 font-sans">
                                            El precio de <span className="font-bold">${scannedItem.price.toLocaleString("es-AR")}</span> es menor o igual al resto de los registros para este rubro. El precio más barato previo era de ${bestKnownAlternative.price.toLocaleString("es-AR")} en {bestKnownAlternative.store}.
                                          </p>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                        <div>
                                          <p className="font-bold">¡Hay alternativas más baratas! 🛒</p>
                                          <p className="text-rose-700 mt-0.5 font-sans">
                                            Podrías ahorrar comprándolo en otro sitio. El artículo alternativo cuesta <span className="font-bold">${bestKnownAlternative.price.toLocaleString("es-AR")}</span> en {bestKnownAlternative.store} ({bestKnownAlternative.type}), ahorrándote <span className="font-bold">${(scannedItem.price - bestKnownAlternative.price).toLocaleString("es-AR")}</span> por unidad.
                                          </p>
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  {/* Grilla de precios */}
                                  <div className="border border-slate-100 rounded-lg overflow-hidden text-xs">
                                    <div className="bg-slate-100 font-bold px-3 py-1.5 text-slate-600 grid grid-cols-12 gap-1 uppercase tracking-wider">
                                      <span className="col-span-5">Establecimiento</span>
                                      <span className="col-span-3 text-right">Contenido</span>
                                      <span className="col-span-4 text-right">Precio</span>
                                    </div>

                                    {/* Escaneo actual */}
                                    <div className="px-3 py-2 bg-emerald-50/70 border-b border-rose-100 grid grid-cols-12 gap-1 font-semibold text-emerald-950 items-center">
                                      <span className="col-span-5 flex items-center gap-1 text-xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        {scannedItem.supermarket || "Góndola"} (Actual)
                                      </span>
                                      <span className="col-span-3 text-right text-slate-500">{scannedItem.amount} {scannedItem.unit}</span>
                                      <span className="col-span-4 text-right font-bold text-slate-800">
                                        ${scannedItem.price.toLocaleString("es-AR")}
                                        <span className="text-[9px] block text-slate-500 font-normal">
                                          {formatUnitPrice(currentScannerUnitPrice, currentScannerNorm.baseUnit)}
                                        </span>
                                      </span>
                                    </div>

                                    {/* Muestras anteriores */}
                                    {allDeals.length === 0 ? (
                                      <div className="px-3 py-4 text-center text-slate-400 italic font-sans text-[11px]">
                                        Aún no hay folletos indexados en el catálogo que coincidan. Guardar esta medición creará la primera referencia histórica.
                                      </div>
                                    ) : (
                                      allDeals.map((deal, dIdx) => (
                                        <div key={dIdx} className="px-3 py-1.5 border-b border-slate-100 grid grid-cols-12 gap-1 items-center hover:bg-slate-50 transition text-[11px]">
                                          <span className="col-span-5 text-slate-700 font-medium truncate">{deal.store} <span className="text-[9px] text-slate-400 block font-normal">{deal.type}</span></span>
                                          <span className="col-span-3 text-right text-slate-500">{deal.unitDesc}</span>
                                          <span className="col-span-4 text-right font-bold text-slate-800">
                                            ${deal.price.toLocaleString("es-AR")}
                                            <span className="text-[9px] block text-slate-400 font-normal">{deal.unitPriceStr}</span>
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* DYNAMIC COMPARISON WITH ARGENTINIAN ONLINE SEARCH CATALOGS */}
                          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                              <Globe className="w-24 h-24 text-white" />
                            </div>

                            <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-2 flex items-center gap-1.5">
                              <Globe className="w-4 h-4 text-sky-400 animate-spin-slow" />
                              Comparador de Buscadores Online (IA)
                            </h3>
                            <p className="text-[11px] text-slate-300 md:max-w-md mb-3 font-sans leading-relaxed">
                              Busque al instante en los portales webs argentinos el producto observado en góndola. Utilice los tips para optimizar las ofertas automáticas de los buscadores interpretados.
                            </p>

                            {customSearchUrls.length === 0 ? (
                              <p className="text-xs italic text-slate-400">No hay buscadores configurados. Puede agregar plantillas en Ajustes.</p>
                            ) : (
                              <div className="space-y-2.5">
                                {customSearchUrls.map((engine) => {
                                  const encodedQuery = encodeURIComponent(scannedItem.productName);
                                  const searchUrlWithQuery = engine.urlTemplate.replace("{producto}", encodedQuery);

                                  return (
                                    <div key={engine.id} className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60 flex flex-col gap-2">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                        <div>
                                          <h4 className="text-xs font-bold text-sky-100">{engine.name}</h4>
                                          {engine.description && (
                                            <p className="text-[10px] text-slate-400 leading-snug">{engine.description}</p>
                                          )}
                                        </div>

                                        <a
                                          href={searchUrlWithQuery}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[11px] font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 px-3 py-1.5 rounded-md flex items-center justify-center gap-1 transition shrink-0 active:scale-95"
                                        >
                                          🔍 Buscar en {engine.name.split(" ")[0]}
                                        </a>
                                      </div>

                                      {/* AI Interpretation toggleable panel */}
                                      {engine.aiInterpretation ? (
                                        <div className="bg-slate-900/80 p-2 rounded border border-slate-700/50 text-[10px] text-slate-300 space-y-1 font-serif leading-normal whitespace-pre-wrap">
                                          {engine.aiInterpretation}
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-between gap-2 bg-slate-900/40 p-1.5 rounded">
                                          <span className="text-[9px] text-slate-400">Sin interpretación de IA generada aún.</span>
                                          <button
                                            onClick={() => handleInterpretSearchUrl(engine)}
                                            disabled={interpretingUrlId === engine.id}
                                            className="text-[9px] font-bold text-sky-300 hover:text-sky-200 underline transition flex items-center gap-1"
                                          >
                                            {interpretingUrlId === engine.id ? (
                                              <>
                                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                                Interpretando...
                                              </>
                                            ) : (
                                              "✨ Interpretar con IA"
                                            )}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Botones de Acción */}
                          <div className="flex flex-col sm:flex-row gap-2 mt-2">
                            <button
                              onClick={addScannedToCatalog}
                              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-xl shadow transition active:scale-95 text-xs flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4 text-emerald-400" />
                              Guardar en Mi Catálogo
                            </button>

                            <button
                              onClick={() => {
                                const norm = getUnitNormalization(scannedItem.amount || 1, scannedItem.unit || "unidad");
                                const simulatedProd: Product = {
                                  id: `sim-${Date.now()}`,
                                  name: scannedItem.productName,
                                  category: scannedItem.category || "Produce",
                                  originalPrice: scannedItem.price,
                                  salePrice: scannedItem.price,
                                  amount: scannedItem.amount || 1,
                                  unit: scannedItem.unit || "unidad",
                                  supermarket: scannedItem.supermarket || "Góndola Escaneada",
                                  dateExtracted: new Date().toISOString(),
                                  unitPrice: scannedItem.price * norm.multiplier,
                                  baseUnit: norm.baseUnit,
                                  sourceType: "manual"
                                };
                                addToShoppingList(simulatedProd);
                                triggerSuccess(`Insertado "${scannedItem.productName}" en su plan activo.`);
                              }}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow transition active:scale-95 text-xs flex items-center justify-center gap-2"
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Agregar a Lista de Compras
                            </button>
                          </div>

                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            </motion.div>
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
                    <p className="font-bold">Gemini API Key Required</p>
                    <p className="mt-1">
                      To run the AI extraction, you need to add your personal Gemini API Key first. All brochures are parsed locally in your browser.
                    </p>
                    <button
                      onClick={() => setActiveTab("settings")}
                      className="mt-2.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg font-semibold transition text-[10px]"
                    >
                      Enter API Key Now
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Drag Box */}
              {!extractedPreview && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-500" />
                    Ingest Leaflet Catalog Brochure
                  </h3>
                  <p className="text-xs text-slate-500 mb-5">
                    Gemini AI automatically parses grocery catalogs, identifies item names, measures, categories, regularly listed prices, discount pricing, and calculates units.
                  </p>

                  <div className="flex flex-col gap-4">
                    
                    {/* Supermarket Brand Hint input */}
                    <div className="w-full sm:max-w-xs">
                      <label className="block text-slate-500 font-medium text-xs mb-1">
                        Supermarket Name (Optional helper)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Safeway, Aldi, Carrefour..."
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
                          {selectedFile ? selectedFile.name : "Drag & Drop brochure file here"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : "Accepts PDF, JPG, PNG flyers"}
                        </p>
                        <button
                          type="button"
                          className="mt-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
                        >
                          Select File From Computer
                        </button>
                      </label>
                    </div>

                    {/* Run action button */}
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" />
                        Upload a single catalog page or leaflet PDF
                      </span>
                      <button
                        onClick={processUpload}
                        disabled={isProcessing || !selectedFile}
                        className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition active:scale-95 flex items-center gap-2 shadow-md shrink-0"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            AI Extracting Prices...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-sky-200" />
                            Run AI Parser
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
                        AI Extraction Output Preview
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <h3 className="text-lg font-bold text-slate-800">Review Prices (Mapped: {extractedPreview.items.length} items)</h3>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={discardPreview}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition active:scale-95"
                      >
                        Discard
                      </button>
                      <button
                        onClick={approvePreview}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition active:scale-95 flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        Approve & Save To Browser DB
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
                      We mapped the supermarket brand to <strong>{extractedPreview.supermarket}</strong>. You can fine-tune specific items below if the print brochure was blurry or price decimals need tweaking.
                    </p>
                  </div>

                  {/* Editable grid */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3">Product Name</th>
                          <th className="p-3">Department</th>
                          <th className="p-3">Original Price ($)</th>
                          <th className="p-3">Sale Price ($)</th>
                          <th className="p-3">Size Amount</th>
                          <th className="p-3">Unit</th>
                          <th className="p-3">Supermarket Key</th>
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
                                  setExtractedPreview({
                                    ...extractedPreview,
                                    supermarket: e.target.value
                                  });
                                  // Sync all item brand entries
                                  const synced = extractedPreview.items.map(it => ({...it, supermarket: e.target.value}));
                                  setExtractedPreview({
                                    supermarket: e.target.value,
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
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Upload Parsing History Log</h4>
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
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Processing...
                            </span>
                          ) : upload.status === "completed" ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold text-[10px] flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Mapped {upload.itemCount} items
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-[10px] flex items-center gap-1" title={upload.errorMessage}>
                              <AlertCircle className="w-2.5 h-2.5" /> Failed
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (confirm("Remove upload history reference? (This will also clear extracted products in this session if not approved)")) {
                              db.deleteUpload(upload.id);
                              setUploads(db.getUploads());
                              
                              // Optionally filter items
                              const remaining = products.filter(p => p.supermarket !== upload.supermarket);
                              db.clearAllProducts();
                              db.saveProducts(remaining);
                              setProducts(remaining);

                              triggerSuccess("Brochure reference removed.");
                            }
                          }}
                          className="text-slate-300 hover:text-rose-500 p-1 rounded"
                          title="Delete brochure entry"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>

                      </div>

                    </div>
                  ))}

                  {uploads.length === 0 && (
                    <p className="text-slate-400 py-4 text-center">No catalog brochures uploaded yet.</p>
                  )}

                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 3: SHOPPING LIST & BUDGET OPTIMIZER */}
          {activeTab === "shopping" && (
            <motion.div
              key="shopping-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              
              {/* Left Side: Active List */}
              <div className="lg:col-span-12 xl:col-span-7 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                      <ShoppingCart className="w-5 h-5 text-sky-500" />
                      Planned Shopping List
                    </h2>
                    <p className="text-xs text-slate-400">Add flyer deals or mock inputs to map your cart</p>
                  </div>
                  {shoppingList.length > 0 && (
                    <button
                      onClick={clearList}
                      className="text-xs text-slate-400 hover:text-rose-500 transition font-medium"
                    >
                      Clear All Items
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {shoppingList.map((item) => (
                    <div 
                      key={item.id} 
                      className={`py-3.5 flex items-center justify-between gap-4 transition ${
                        item.checked ? "opacity-50" : ""
                      }`}
                    >
                      {/* Left: Check and details */}
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => toggleListItemChecked(item.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                            item.checked 
                              ? "bg-slate-900 border-slate-950 text-white" 
                              : "border-slate-300 hover:border-sky-500 bg-white"
                          }`}
                        >
                          {item.checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <div className="min-w-0">
                          <h4 className={`text-sm font-semibold text-slate-800 truncate leading-snug ${
                            item.checked ? "line-through text-slate-400" : ""
                          }`}>
                            {item.name}
                          </h4>
                          <div className="flex flex-wrap text-xs text-slate-400 gap-x-2 mt-0.5">
                            <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                              <Store className="w-3 h-3 text-slate-400" />
                              {item.supermarket}
                            </span>
                            <span>•</span>
                            <span>{item.amount} {item.unit}</span>
                            <span>•</span>
                            <span className="font-mono">{formatUnitPrice(item.unitPrice, item.baseUnit)}</span>
                          </div>

                          {/* Comparison helper indicators */}
                          {(() => {
                            const lastPur = getLastPurchaseInfo(item.name);
                            const bestOffer = getBestAvailableOffer(item.name, item.category);
                            
                            return (
                              <div className="mt-2 space-y-1 text-[11px] font-sans">
                                {lastPur && (
                                  <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
                                    <span className="font-semibold text-slate-600">Historial de Compra:</span>
                                    <span>${lastPur.unitPriceOfItem.toFixed(2)}/u ({lastPur.store} • {lastPur.date})</span>
                                    {item.price < lastPur.unitPriceOfItem ? (
                                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded animate-pulse">
                                        ¡Ahorras {( ( (lastPur.unitPriceOfItem - item.price) / lastPur.unitPriceOfItem ) * 100 ).toFixed(0)}%!
                                      </span>
                                    ) : item.price > lastPur.unitPriceOfItem ? (
                                      <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-1 rounded">
                                        +{(((item.price - lastPur.unitPriceOfItem) / lastPur.unitPriceOfItem) * 100).toFixed(0)}% más costoso
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 bg-slate-50 px-1 rounded">Mismo precio</span>
                                    )}
                                  </div>
                                )}
                                
                                {bestOffer && bestOffer.price < item.price && (
                                  <div className="flex flex-wrap items-center gap-1.5 text-indigo-600 bg-indigo-50/70 py-1.5 px-2.5 rounded-lg border border-indigo-100 mt-1">
                                    <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                                    <span className="text-[10 px] sm:text-xs">
                                      Oferta encontrada: <strong>${bestOffer.price.toFixed(2)}</strong> en <strong>{bestOffer.supermarket}</strong>
                                      {bestOffer.sourceType === "brochure" ? " (Folleto subido)" : " (Online)"}
                                    </span>
                                    <button
                                      id={`btn-apply-offer-${item.id}`}
                                      onClick={() => {
                                        const norm = getUnitNormalization(item.amount, item.unit);
                                        const updatedItem = {
                                          ...item,
                                          price: bestOffer.price,
                                          supermarket: bestOffer.supermarket,
                                          unitPrice: bestOffer.price * norm.multiplier
                                        };
                                        db.saveShoppingListItem(updatedItem);
                                        setShoppingList(db.getShoppingList());
                                        triggerSuccess(`Actualizado ${item.name} al precio de oferta de $${bestOffer.price.toFixed(2)} en ${bestOffer.supermarket}!`);
                                      }}
                                      className="ml-auto font-bold underline hover:text-indigo-800 text-[10px] shrink-0"
                                    >
                                      Aplicar Oferta
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right: Quantity modifiers and pricing */}
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        
                        {/* Quantity Counter */}
                        <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                          <button
                            onClick={() => updateListItemQuantity(item.id, item.quantity - 1)}
                            className="px-2.5 py-1 text-slate-500 hover:bg-slate-100 font-bold"
                          >
                            -
                          </button>
                          <span className="px-2 text-xs font-bold text-slate-800">{item.quantity}</span>
                          <button
                            onClick={() => updateListItemQuantity(item.id, item.quantity + 1)}
                            className="px-2.5 py-1 text-slate-500 hover:bg-slate-100 font-bold"
                          >
                            +
                          </button>
                        </div>

                        {/* Calculated Subtotal */}
                        <div className="w-16">
                          <p className="text-sm font-bold text-slate-800">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">(${item.price.toFixed(2)} ea)</p>
                        </div>

                        <button
                          onClick={() => deleteListItem(item.id)}
                          className="text-slate-300 hover:text-rose-500 rounded p-1"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>

                      </div>

                    </div>
                  ))}

                  {shoppingList.length === 0 && (
                    <div className="py-12 text-center text-slate-400">
                      <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-600">Your Shopping List is Empty</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-[250px] mx-auto">
                        Return to the Product Catalog to add booklet items, or configure custom ones with the seeder.
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Side: Budget Optimization Insights */}
              <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-4">
                
                {shoppingOptimization && (
                  <>
                    
                    {/* Value Metrics */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-md border border-slate-700/50">
                      <h3 className="text-xs uppercase font-bold text-sky-400 tracking-wider flex items-center gap-1.5">
                        <Calculator className="w-4 h-4" />
                        AI Budget Optimization Insights
                      </h3>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">As-Selected Total</p>
                          <p className="text-lg font-bold mt-0.5 text-slate-200">${shoppingOptimization.activeSelectedListTotal.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-sky-300 font-semibold">Cheapest Split Path</p>
                          <p className="text-lg font-extrabold mt-0.5 text-emerald-400">${shoppingOptimization.absoluteCheapestCost.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Savings alert pill */}
                      {shoppingOptimization.splitShoppingSavings > 0 ? (
                        <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-emerald-400">Estimated Saving Potential</p>
                            <p className="text-[10px] text-emerald-300/80">By split-buying across standard deals</p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-extrabold text-emerald-400">
                              -${shoppingOptimization.splitShoppingSavings.toFixed(2)}
                            </p>
                            <p className="text-[9px] bg-emerald-400 text-slate-950 font-bold px-1 rounded inline-block mt-0.5">
                              SAVE {shoppingOptimization.splitSavingsPct.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 bg-slate-800 border border-slate-700 p-3 rounded-xl text-center text-xs text-slate-400">
                          🎉 Your list is already fully optimized for the absolute lowest pricing!
                        </div>
                      )}
                    </div>

                    {/* Split Shopping Plan breakdown */}
                    {shoppingOptimization.splitShoppingSavings > 0 && (
                      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                        <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3">
                          Split Deal Action Plan
                        </h3>
                        
                        <div className="flex flex-col gap-2 max-h-[30vh] overflow-y-auto">
                          {shoppingOptimization.splitShoppingPlan.map((planItem, idx) => {
                            const isChanged = planItem.originalMarket !== planItem.bestMarket;
                            return (
                              <div key={idx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl text-xs flex justify-between items-center gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{planItem.itemName}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Qty: {planItem.quantity}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-bold text-slate-900">
                                    Buy at <span className="text-sky-600 font-extrabold">{planItem.bestMarket}</span>
                                  </p>
                                  <div className="flex items-center gap-1 justify-end mt-0.5">
                                    <span className="text-[10px] font-mono text-slate-800 font-semibold">
                                      ${(planItem.bestPrice * planItem.quantity).toFixed(2)}
                                    </span>
                                    {isChanged && (
                                      <span className="text-[9px] text-rose-500 line-through">
                                        ${(planItem.originalPrice * planItem.quantity).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cost comparison by single Supermarket block */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Full Cart cost comparison by Store</h4>
                      <div className="flex flex-col gap-2.5">
                        {shoppingOptimization.marketBudgets.map((budget, idx) => {
                          const isWorse = budget.totalCost > shoppingOptimization.activeSelectedListTotal;
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg border border-slate-100 group">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                                  {idx + 1}
                                </span>
                                <span className="font-semibold text-slate-700">{budget.marketName}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-900">${budget.totalCost.toFixed(2)}</span>
                                <span className={`text-[9px] block ${isWorse ? 'text-rose-500' : 'text-emerald-500 font-semibold'}`}>
                                  {budget.percentSaved > 0 
                                    ? `Save ${budget.percentSaved.toFixed(0)}% vs Selected` 
                                    : budget.percentSaved < 0 
                                    ? `+${Math.abs(budget.percentSaved).toFixed(0)}% More expensive`
                                    : 'Selected baseline'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tarjeta de Sugerencias Rápidas */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 rounded-2xl shadow-sm border border-amber-200/60 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          ¿Qué te falta comprar?
                        </h4>
                        <p className="text-[11px] text-amber-700/80 mb-3 leading-snug">
                          Usa Inteligencia Artificial para recomendar productos habituales basados en tus tickets de compra guardados en Argentina.
                        </p>
                        
                        {suggestedItems.length > 0 ? (
                          <div className="flex flex-col gap-1.5 mb-3 max-h-[140px] overflow-y-auto scrollbar-none">
                            {suggestedItems.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-xl text-xs border border-amber-100/50">
                                <div className="truncate min-w-0 pr-2">
                                  <span className="font-semibold text-slate-800">{item.name}</span>
                                  <span className="text-[10px] block text-slate-400 truncate">{item.supermarket} • {item.reason}</span>
                                </div>
                                <button
                                  onClick={() => handleAddSuggestedToShopping(item)}
                                  className="p-1 text-white bg-amber-500 rounded hover:bg-amber-600 shrink-0 cursor-pointer"
                                  title="Añadir"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic mb-3">Sube tickets en la pestaña "Historial y Tickets" para obtener recomendaciones automáticas de reposición.</p>
                        )}
                      </div>
                      
                      {receipts.length > 0 && (
                        <button
                          onClick={handleGenerateAISuggestions}
                          disabled={isGeneratingSuggestions}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 font-bold text-white text-xs rounded-xl flex items-center justify-center gap-1 transition-all disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {isGeneratingSuggestions ? "Analizando tickets..." : suggestedItems.length > 0 ? "Actualizar Sugerencias" : "Generar Sugerencias de IA"}
                        </button>
                      )}
                    </div>

                  </>
                )}

              </div>

            </motion.div>
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
                                <div key={it.id} className="flex justify-between text-[10px] text-slate-550">
                                  <span className="truncate pr-4">• {it.name}</span>
                                  <span className="shrink-0 font-mono text-slate-700">${it.price.toFixed(0)}</span>
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
                    Brinde su clave de API de Google Gemini para procesar folletos y etiquetas de precio en tiempo real directamente en el dispositivo. La clave se almacena cifrada localmente en su navegador y jamás se transmite a servidores intermedios de terceros.
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

              {/* NUEVA SECCIÓN: Google Sheets Base de Datos en la Nube */}
              <div id="panel-gsheets" className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-500" />
                      Google Sheets como Base de Datos
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Use una planilla de Google Sheets como base de datos en la nube. Guarda su historial de compras reales y el catálogo de ofertas recopilado de folletos de manera persistente.
                    </p>
                  </div>
                  <div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="toggle-gsheets"
                        type="checkbox"
                        checked={gsheetsEnabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setGsheetsEnabled(val);
                          localStorage.setItem("bp_gsheets_enabled", String(val));
                          if (val) {
                            triggerSuccess("Base de datos por Google Sheets habilitada. Complete SSID y URL de GAS, luego haga clic en Sincronizar.");
                          } else {
                            triggerSuccess("Base de datos deshabilitada. Guardando localmente en este navegador.");
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-2 text-xs font-semibold text-slate-700">Activo</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4 font-sans text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">ID de Google Sheet (SSID) *</label>
                      <input
                        id="input-gsheets-ssid"
                        type="text"
                        placeholder="Ej: 1A2b3c4D5e6F7g8H9i0J_kLmNoP"
                        value={gsheetsSSID}
                        onChange={(e) => {
                          setGsheetsSSID(e.target.value);
                          localStorage.setItem("bp_gsheets_ssid", e.target.value);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">URL de la Web App de Apps Script (GAS) *</label>
                      <input
                        id="input-gsheets-url"
                        type="text"
                        placeholder="Ej: https://script.google.com/macros/s/AKfycb.../exec"
                        value={gsheetsUrl}
                        onChange={(e) => {
                          setGsheetsUrl(e.target.value);
                          localStorage.setItem("bp_gsheets_url", e.target.value);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      id="btn-gsheets-sync"
                      onClick={() => handleSyncGSheets()}
                      disabled={isSyncingGSheets || !gsheetsEnabled}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer text-xs"
                    >
                      {isSyncingGSheets ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Sincronizar y Fusionar con Sheets
                        </>
                      )}
                    </button>
                    <button
                      id="btn-gsheets-share"
                      onClick={handleShareGSheets}
                      disabled={!gsheetsSSID && !gsheetsUrl}
                      className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 border border-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer text-xs"
                      title="Copiar enlace con SSID y URL de GAS para acceder directamente o compartir su configuración"
                    >
                      <Share2 className="w-4 h-4 text-slate-500" />
                      Compartir Enlace
                    </button>
                  </div>

                  {gsheetsSyncMessage && (
                    <div className={`p-3 rounded-xl border flex items-start gap-2 ${
                      gsheetsSyncStatus === "success" 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                        : gsheetsSyncStatus === "error"
                        ? "bg-rose-50 border-rose-100 text-rose-800"
                        : "bg-blue-50 border-blue-100 text-blue-800"
                    }`}>
                      {gsheetsSyncStatus === "success" ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : gsheetsSyncStatus === "error" ? (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 animate-spin mt-0.5" />
                      )}
                      <div>
                        <span className="font-semibold block text-xs">Estado de Sincronización</span>
                        <p className="text-[11px] mt-0.5 leading-relaxed">{gsheetsSyncMessage}</p>
                      </div>
                    </div>
                  )}

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
    var ssid = data.ssid;
    
    var ss = SpreadsheetApp.openById(ssid);
    
    if (action === "syncAll") {
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
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                      </pre>
                    </details>
                  </div>
                </div>
              </div>

              {/* DYNAMIC SEARCH URL MANAGEMENT SECTION */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                <div className="border-b border-slate-100 pb-3 font-sans">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-500" />
                    Buscadores de Supermercados (Argentina)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Configure portales de venta online para activar la búsqueda instantánea con un clic desde el Escáner de Góndola. La IA generará pautas de búsqueda y tips específicos para cada cadena.
                  </p>
                </div>

                {/* Formulario de Alta de nuevo motor */}
                <form onSubmit={handleSaveSearchUrl} className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl space-y-3 font-sans">
                  <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">Agregar nuevo buscador manual</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Nombre del Supermercado</label>
                      <input
                        type="text"
                        placeholder="Ej: Coto Digital, ChangoMas, etc"
                        value={newSearchUrlName}
                        onChange={(e) => setNewSearchUrlName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Descripción corta</label>
                      <input
                        type="text"
                        placeholder="Ej: Ofertas del día y sucursal CABA"
                        value={newSearchUrlDesc}
                        onChange={(e) => setNewSearchUrlDesc(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-600 font-semibold mb-1">Plantilla de URL de Búsqueda (Con marcador <span className="font-mono text-indigo-600 font-bold">{"{producto}"}</span>)</label>
                      <input
                        type="text"
                        placeholder="Ej: https://www.cotodigital3.com.ar/sitios/cdg/busqueda?_dyncharset=utf-8&Ntt={producto}"
                        value={newSearchUrlTemplate}
                        onChange={(e) => setNewSearchUrlTemplate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-700 text-[11px] focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                      />
                      <span className="text-[9px] text-slate-400 block mt-1">El sistema reemplazará automáticamente {"{producto}"} con el nombre del artículo escaneado o seleccionado.</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition shadow active:scale-95 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Guardar Buscador
                  </button>
                </form>

                {/* Listado de Motores Activos */}
                <div className="space-y-2 font-sans">
                  <h4 className="text-xs font-bold text-slate-700">Motores de búsqueda activos ({customSearchUrls.length})</h4>
                  
                  {customSearchUrls.length === 0 ? (
                    <p className="text-xs italic text-slate-400">No hay buscadores configurados en su base de datos local.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {customSearchUrls.map((urlItem) => (
                        <div key={urlItem.id} className="bg-white p-3 rounded-xl border border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1 max-w-md">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              {urlItem.name}
                            </span>
                            <p className="text-[10px] text-slate-500">{urlItem.description}</p>
                            <span className="text-[9px] block text-slate-400 truncate max-w-xs md:max-w-lg font-mono">{urlItem.urlTemplate}</span>

                            {urlItem.aiInterpretation && (
                              <div className="mt-2 bg-indigo-50/50 p-2 rounded border border-indigo-100 text-[10px] text-slate-700 whitespace-pre-wrap font-serif">
                                {urlItem.aiInterpretation}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                            <button
                              onClick={() => handleInterpretSearchUrl(urlItem)}
                              disabled={interpretingUrlId === urlItem.id}
                              className="bg-slate-100 hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] transition flex items-center gap-1 disabled:opacity-50"
                            >
                              {interpretingUrlId === urlItem.id ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Analizando...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 text-indigo-500" />
                                  Interpretar con IA
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleDeleteSearchUrl(urlItem.id, urlItem.name)}
                              className="text-rose-500 hover:text-rose-600 font-bold bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-100 transition"
                              title="Eliminar Buscador"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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

                  {/* Seed Demo Data block */}
                  <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between items-start bg-slate-50/30">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-sky-500" />
                        Cargar Catálogo de Demostración
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        Carga precios históricos argentinos simulados de Carrefour, Coto y Jumbo con sus pesos y litros metrificados para evaluar el graficador de ahorro.
                      </p>
                    </div>
                    <button
                      onClick={loadDemoData}
                      className="mt-4 bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold px-3 py-2 rounded-lg text-xs transition active:scale-95 shadow"
                    >
                      Simular Precios de Referencia
                    </button>
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

    </div>
  );
}
