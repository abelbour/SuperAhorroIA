import React from "react";
import { Camera, AlertCircle, RefreshCw, ScanLine, Upload, Calculator, TrendingUp, Check, Info, Globe, Database, Search, Plus, ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import { Product, CatalogSource, ApiProductResult } from "./types";
import { formatUnitPrice, getUnitNormalization, findSimilarOnlineProducts } from "./utils";
import DebouncedInput from "./DebouncedInput";

interface ScanTabProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  apiKey: string;
  isCameraActive: boolean;
  scannedItem: any;
  setScannedItem: (v: any) => void;
  scanCapturedImage: string | null;
  setScanCapturedImage: (v: string | null) => void;
  isCurrentlyScanning: boolean;
  cameraError: string | null;
  products: Product[];
  catalogSources: CatalogSource[];
  onlineSearchResults: ApiProductResult[];
  isSearchingOnline: boolean;
  startCamera: () => void;
  stopCamera: () => void;
  capturePhotoAndScan: () => void;
  handleScanFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  executeOnlineSearch: (query: string) => Promise<void>;
  handleAddApiProductToCatalog: (item: ApiProductResult) => void;
  addScannedToCatalog: () => void;
  addToShoppingList: (product: Product) => void;
  triggerSuccess: (msg: string) => void;
  setActiveTab: (tab: string) => void;
}

const ScanTab = React.memo(function ScanTab({
  videoRef,
  apiKey,
  isCameraActive,
  scannedItem,
  setScannedItem,
  scanCapturedImage,
  setScanCapturedImage,
  isCurrentlyScanning,
  cameraError,
  products,
  catalogSources,
  onlineSearchResults,
  isSearchingOnline,
  startCamera,
  stopCamera,
  capturePhotoAndScan,
  handleScanFileUpload,
  executeOnlineSearch,
  handleAddApiProductToCatalog,
  addScannedToCatalog,
  addToShoppingList,
  triggerSuccess,
  setActiveTab,
}: ScanTabProps) {
  return (
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
                Para escanear y comparar precios automáticamente, necesitas configurar tu API Key de Gemini en la sección de Ajustes.
              </p>
              <button
                onClick={() => setActiveTab("settings")}
                className="mt-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition active:scale-95"
              >
                Ingresar API Key Ahora
              </button>
            </div>
          </div>
        )}

        {/* Camera Controls */}
        <div className="mt-4 flex flex-wrap gap-3">
          {!isCameraActive ? (
            <button
              onClick={startCamera}
              disabled={!apiKey}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold px-4 py-2.5 rounded-xl transition active:scale-95 text-sm flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Encender Cámara
            </button>
          ) : (
            <>
              <div className="relative bg-black rounded-xl overflow-hidden w-full max-w-md">
                <video ref={videoRef} className="w-full h-auto rounded-xl" autoPlay playsInline />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={capturePhotoAndScan}
                  disabled={isCurrentlyScanning}
                  className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-semibold px-4 py-2.5 rounded-xl transition active:scale-95 text-sm flex items-center gap-2"
                >
                  {isCurrentlyScanning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ScanLine className="w-4 h-4" />
                  )}
                  {isCurrentlyScanning ? "Analizando..." : "Capturar y Comparar"}
                </button>
                <button
                  onClick={stopCamera}
                  className="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-4 py-2.5 rounded-xl transition active:scale-95 text-sm flex items-center gap-2"
                >
                  Apagar Cámara
                </button>
              </div>
            </>
          )}
        </div>

        {/* File Upload fallback */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2 font-medium">O subí una foto desde tu dispositivo:</p>
          <label className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-xl cursor-pointer transition active:scale-95 text-sm">
            <Upload className="w-4 h-4" />
            Subir Foto de Precio
            <input type="file" accept="image/*" capture="environment" onChange={handleScanFileUpload} className="hidden" />
          </label>
        </div>

        {/* Error display */}
        {cameraError && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs font-medium">{cameraError}</p>
          </div>
        )}

        {/* Scan Result / Review */}
        {scannedItem && (
          <div className="mt-6 bg-gradient-to-br from-sky-50 to-indigo-50/40 rounded-2xl border border-sky-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="font-bold text-slate-700 text-sm">Resultado del Escaneo</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setScannedItem(null); setScanCapturedImage(null); }}
                  className="text-[10px] text-slate-400 hover:text-rose-500 font-semibold transition"
                >
                  ✕ Descartar
                </button>
              </div>
            </div>

            {/* Scanned image thumbnail */}
            {scanCapturedImage && (
              <div className="mb-4">
                <img src={scanCapturedImage} alt="Captura escaneada" className="w-full max-h-48 object-contain rounded-xl bg-white shadow-sm" />
              </div>
            )}

            {/* Editable fields extracted by AI */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col gap-3">
              <span className="text-[10px] font-bold tracking-widest text-emerald-600 bg-emerald-50 self-start px-2 py-0.5 rounded-full uppercase">Detalles Extraídos por IA</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="md:col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Nombre del Producto</label>
                  <DebouncedInput
                    type="text"
                    value={scannedItem.productName}
                    onChange={(val) => setScannedItem((prev: any) => ({ ...prev, productName: val }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Precio ($ ARS)</label>
                  <DebouncedInput
                    type="number"
                    step="0.01"
                    value={String(scannedItem.price)}
                    onChange={(val) => setScannedItem((prev: any) => ({ ...prev, price: Number(val) || 0 }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Supermercado</label>
                  <DebouncedInput
                    type="text"
                    value={scannedItem.supermarket}
                    onChange={(val) => setScannedItem((prev: any) => ({ ...prev, supermarket: val }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Cantidad Neto / Contenido</label>
                  <DebouncedInput
                    type="number"
                    value={String(scannedItem.amount)}
                    onChange={(val) => setScannedItem((prev: any) => ({ ...prev, amount: Number(val) || 1 }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Unidad Medida</label>
                  <select
                    value={scannedItem.unit || "unit"}
                    onChange={(e) => setScannedItem((prev: any) => ({ ...prev, unit: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                  >
                    <option value="unit">Unidad</option>
                    <option value="kg">Kilogramo</option>
                    <option value="g">Gramo</option>
                    <option value="l">Litro</option>
                    <option value="ml">Mililitro</option>
                    <option value="pack">Pack / Atado</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-500 font-semibold mb-1">Categoría (opcional)</label>
                  <select
                    value={scannedItem.category || "Produce"}
                    onChange={(e) => setScannedItem((prev: any) => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                  >
                    <option value="Produce">Verdulería y Frutas</option>
                    <option value="Meat">Carnes y Pescados</option>
                    <option value="Dairy">Lácteos y Huevos</option>
                    <option value="Bakery">Panadería</option>
                    <option value="Pantry">Almacén y Comestibles</option>
                    <option value="Beverages">Bebidas</option>
                    <option value="Cleaning">Limpieza</option>
                    <option value="Other">Otros</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Unit Price Calculation IIFE */}
            {(() => {
              const norm = getUnitNormalization(scannedItem.amount || 1, scannedItem.unit || "unidad");
              const scannerUnitPrice = scannedItem.price * norm.multiplier;
              return (
                <div className="mt-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between text-slate-900">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    CÁLCULO DE PRECIO UNITARIO
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 line-through">${scannedItem.price.toFixed(2)}</span>
                    <span className="text-sm font-black text-emerald-700">{formatUnitPrice(scannerUnitPrice, norm.baseUnit)}</span>
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                      {scannedItem.price > 0 ? `Metrificado (${scannedItem.amount || 1} → ${norm.baseUnit})` : ""}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Comparison / Deals IIFE */}
            {(() => {
              const queryStr = scannedItem.productName.toLowerCase();
              const matchedLocal = products.filter(p =>
                p.name.toLowerCase().includes(queryStr) || queryStr.includes(p.name.toLowerCase())
              );
              const matchedOnline = findSimilarOnlineProducts(scannedItem.productName, scannedItem.category);
              const allDeals = [
                ...matchedLocal.map(p => ({
                  store: p.supermarket,
                  price: p.salePrice,
                  originalPrice: p.originalPrice,
                  type: "Fol Digit",
                  dateExtracted: p.dateExtracted,
                  unitPrice: p.unitPrice,
                  unit: p.baseUnit || p.unit,
                  amount: p.amount,
                  productUnit: p.unit,
                })),
                ...matchedOnline.map(o => ({
                  store: o.storeName,
                  price: o.price,
                  originalPrice: o.price,
                  type: "Cat Onl",
                  dateExtracted: new Date().toISOString(),
                  unitPrice: o.unitPrice,
                  unit: o.baseUnit || o.unit,
                  amount: o.amount,
                  productUnit: o.unit,
                })),
              ];
              const currentScannerNorm = getUnitNormalization(scannedItem.amount || 1, scannedItem.unit || "unidad");
              const currentScannerUnitPrice = scannedItem.price * currentScannerNorm.multiplier;
              const bestKnownAlternative = allDeals.reduce<(typeof allDeals)[0] | null>(
                (best, deal) => (deal.unitPrice < (best?.unitPrice ?? Infinity) ? deal : best), null
              );
              const isGoodDeal = bestKnownAlternative ? scannedItem.unitPrice <= bestKnownAlternative.unitPrice : null;

              return (
                <div className="space-y-3">
                  <div className={`mt-3 p-3 rounded-xl flex items-center gap-3 text-xs font-semibold ${
                    isGoodDeal === null ? "bg-slate-100 text-slate-600" :
                    isGoodDeal ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                    "bg-rose-100 text-rose-800 border border-rose-300"
                  }`}>
                    {isGoodDeal === null ? (
                      <>No hay datos de comparación disponibles.</>
                    ) : isGoodDeal ? (
                      <><TrendingUp className="w-4 h-4" /> ¡Buen precio! Este producto está entre los más baratos registrados.</>
                    ) : (
                      <><AlertCircle className="w-4 h-4" /> Este precio es más alto que otras alternativas conocidas (desde ${bestKnownAlternative!.price.toFixed(2)} en {bestKnownAlternative!.store}).</>
                    )}
                  </div>

                  {allDeals.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 font-medium">
                            <th className="text-left px-2 py-1">Tienda</th>
                            <th className="text-right px-2 py-1">Precio</th>
                            <th className="text-right px-2 py-1">Unitario</th>
                            <th className="text-center px-2 py-1">Tipo</th>
                            <th className="text-left px-2 py-1">Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-sky-100/50 font-semibold text-slate-800">
                            <td className="px-2 py-1.5 rounded-l-lg">
                              <ScanLine className="w-3 h-3 inline mr-1" />
                              {scannedItem.supermarket || "Hoy"}
                            </td>
                            <td className="text-right px-2 py-1.5">${scannedItem.price.toFixed(2)}</td>
                            <td className="text-right px-2 py-1.5">{formatUnitPrice(currentScannerUnitPrice, currentScannerNorm.baseUnit)}</td>
                            <td className="text-center px-2 py-1.5">
                              <span className="bg-sky-200 text-sky-800 px-1.5 py-0.5 rounded text-[10px] font-bold">Escaneo</span>
                            </td>
                            <td className="px-2 py-1.5 rounded-r-lg text-[10px] text-slate-400">recién escaneado</td>
                          </tr>
                          {allDeals.map((deal, i) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-2 py-1.5">{deal.store}</td>
                              <td className="text-right px-2 py-1.5">${deal.price.toFixed(2)}</td>
                              <td className="text-right px-2 py-1.5">{formatUnitPrice(deal.unitPrice, deal.unit)}</td>
                              <td className="text-center px-2 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  deal.type === "Fol Digit" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
                                }`}>{deal.type}</span>
                              </td>
                              <td className="px-2 py-1.5 text-[10px] text-slate-400">
                                {deal.amount > 1 ? `${deal.amount} ${deal.productUnit}` : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={addScannedToCatalog}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl transition active:scale-95 text-xs flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5" />
                Guardar en Mi Catálogo
              </button>

              {apiKey && (
                <button
                  onClick={() => executeOnlineSearch(scannedItem.productName)}
                  disabled={isSearchingOnline}
                  className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-semibold px-4 py-2.5 rounded-xl transition active:scale-95 text-xs flex items-center gap-1.5"
                >
                  {isSearchingOnline ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                  {isSearchingOnline ? "Buscando..." : "Buscar Precios Online"}
                </button>
              )}

              {(() => {
                const norm = getUnitNormalization(scannedItem.amount || 1, scannedItem.unit || "unidad");
                const simulatedProd: Product = {
                  id: `scan-${Date.now()}`,
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
                  description: "Captured via smart camera",
                  sourceType: "manual",
                };
                return (
                  <button
                    onClick={() => { addToShoppingList(simulatedProd); triggerSuccess(`"${scannedItem.productName}" agregado a tu lista de compras.`); }}
                    className="bg-white hover:bg-slate-50 text-sky-700 font-semibold px-4 py-2.5 rounded-xl border border-sky-200 transition active:scale-95 text-xs flex items-center gap-1.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Agregar a Lista de Compras
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Online Search Results (if any) */}
      {onlineSearchResults.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <Search className="w-4 h-4 text-sky-500" />
            <span className="font-bold text-slate-700 text-sm">Resultados de Búsqueda Online ({onlineSearchResults.length})</span>
          </div>
          <div className="space-y-2">
            {onlineSearchResults.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-700 block truncate">{item.productName}</span>
                  <span className="text-[10px] text-slate-400">{item.shop} &middot; {item.amount > 1 ? `${item.amount} ${item.unit}` : ""}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-sky-700">${item.price.toFixed(2)}</span>
                  <button
                    onClick={() => handleAddApiProductToCatalog(item)}
                    className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition active:scale-90"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});

export default ScanTab;
