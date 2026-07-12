import React, { useMemo, useState, useEffect } from "react";
import { Store, Upload, Search, Globe, RefreshCw, Plus, Trash, TrendingUp, ShoppingCart, Info, Bell } from "lucide-react";
import { motion } from "motion/react";
import { Product, ApiProductResult } from "./types";
import { formatUnitPrice, translateCategory } from "./utils";
import DebouncedInput from "./DebouncedInput";

interface CatalogTabProps {
  products: Product[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  supermarketFilter: string;
  setSupermarketFilter: (v: string) => void;
  sortBy: "name" | "price_asc" | "price_desc" | "unitprice_asc";
  setSortBy: (v: "name" | "price_asc" | "price_desc" | "unitprice_asc") => void;
  uniqueSupermarkets: string[];
  selectedCompareProduct: Product | null;
  setSelectedCompareProduct: (v: Product | null) => void;
  customItemName: string;
  setCustomItemName: (v: string) => void;
  customItemCategory: string;
  setCustomItemCategory: (v: string) => void;
  customItemPrice: string;
  setCustomItemPrice: (v: string) => void;
  customItemAmount: string;
  setCustomItemAmount: (v: string) => void;
  customItemUnit: string;
  setCustomItemUnit: (v: string) => void;
  customItemSupermarket: string;
  setCustomItemSupermarket: (v: string) => void;
  onlineSearchResults: ApiProductResult[];
  onlineSearchQuery: string;
  setOnlineSearchQuery: (v: string) => void;
  isSearchingOnline: boolean;

  executeOnlineSearch: (query: string) => Promise<void>;
  addManualProduct: (e: React.FormEvent) => void;
  deleteProduct: (id: string) => void;
  addToShoppingList: (product: Product) => void;
  handleAddApiProductToCatalog: (item: ApiProductResult) => void;
  handleAddAllApiProductsToCatalog: () => void;
  setActiveTab: (tab: "home" | "upload" | "catalog" | "shopping" | "settings" | "scan" | "receipts") => void;
  onCreateAlert: (productName: string, currentPrice: number) => void;
}

const CatalogTab = React.memo(function CatalogTab({
  products,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  supermarketFilter,
  setSupermarketFilter,
  sortBy,
  setSortBy,
  uniqueSupermarkets,
  selectedCompareProduct,
  setSelectedCompareProduct,
  customItemName,
  setCustomItemName,
  customItemCategory,
  setCustomItemCategory,
  customItemPrice,
  setCustomItemPrice,
  customItemAmount,
  setCustomItemAmount,
  customItemUnit,
  setCustomItemUnit,
  customItemSupermarket,
  setCustomItemSupermarket,
  onlineSearchResults,
  onlineSearchQuery,
  setOnlineSearchQuery,
  isSearchingOnline,
  executeOnlineSearch,
  addManualProduct,
  deleteProduct,
  addToShoppingList,
  handleAddApiProductToCatalog,
  handleAddAllApiProductsToCatalog,
  setActiveTab,
  onCreateAlert,
}: CatalogTabProps) {
  useEffect(() => { setPage(1); }, [searchQuery, categoryFilter, supermarketFilter, dateFrom, dateTo, sortBy]);

  const filteredProducts = useMemo(() => {
    const latestItemsMap: { [key: string]: Product } = {};
    products.forEach(p => {
      const key = `${p.name.toLowerCase().trim()}_${p.supermarket.toLowerCase().trim()}`;
      const existing = latestItemsMap[key];
      if (!existing || new Date(p.dateExtracted) > new Date(existing.dateExtracted)) {
        latestItemsMap[key] = p;
      }
    });
    let list = Object.values(latestItemsMap);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.supermarket.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "All") {
      list = list.filter(p => p.category === categoryFilter);
    }
    if (supermarketFilter !== "All") {
      list = list.filter(p => p.supermarket === supermarketFilter);
    }
    if (dateFrom) {
      list = list.filter(p => !p.endDate || new Date(p.endDate) >= new Date(dateFrom));
    }
    if (dateTo) {
      list = list.filter(p => !p.startDate || new Date(p.startDate) <= new Date(dateTo));
    }
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price_asc") return a.salePrice - b.salePrice;
      if (sortBy === "price_desc") return b.salePrice - a.salePrice;
      if (sortBy === "unitprice_asc") return a.unitPrice - b.unitPrice;
      return 0;
    });
    return list;
  }, [products, searchQuery, categoryFilter, supermarketFilter, sortBy, dateFrom, dateTo]);

  const ITEMS_PER_PAGE = 30;
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const productPriceHistory = useMemo(() => {
    if (!selectedCompareProduct) return [];
    const pName = selectedCompareProduct.name.toLowerCase().trim();
    const matches = products.filter(p => p.name.toLowerCase().trim() === pName);
    return matches.map(m => ({
      date: new Date(m.dateExtracted).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}),
      timestamp: new Date(m.dateExtracted).getTime(),
      price: m.salePrice,
      unitPrice: m.unitPrice,
      supermarket: m.supermarket,
    })).sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedCompareProduct, products]);

  const catalogComparisons = useMemo(() => {
    if (!selectedCompareProduct) return [];
    const name = selectedCompareProduct.name.toLowerCase().trim();
    return products
      .filter(p => p.name.toLowerCase().trim() !== name && p.name.toLowerCase().includes(name))
      .map(p => ({
        storeName: p.supermarket,
        productName: p.name,
        price: p.salePrice,
        amount: p.amount,
        unit: p.unit,
        unitPrice: p.unitPrice,
        baseUnit: p.baseUnit || p.unit,
      }));
  }, [selectedCompareProduct, products]);

  const lowestPrices = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      const key = p.name.toLowerCase().trim();
      if (!(key in map) || p.salePrice < map[key]) {
        map[key] = p.salePrice;
      }
    });
    return map;
  }, [products]);

  return (
    <motion.div
      key="catalog-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      {products.length === 0 && (
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 rounded-2xl p-6 md:p-8 text-center max-w-2xl mx-auto my-8">
          <Store className="w-12 h-12 text-sky-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Tu base de datos de comparación de productos está vacía</h3>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            Para comenzar a ahorrar, puedes subir folletos de supermercados en formato PDF, escanear o cargar un ticket de compra con la cámara inteligente, o sincronizar tus datos desde Google Sheets.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setActiveTab("upload")}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-md transition active:scale-95 text-sm flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Subir Folleto PDF
            </button>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div>
          {/* Filters Header */}
          <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-100 mb-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar productos, categorías o supermercados..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
              >
                <option value="All">Todas las Categorías</option>
                {Array.from(new Set(products.map(p => p.category))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={supermarketFilter}
                onChange={(e) => setSupermarketFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
              >
                <option value="All">Todos los Supermercados</option>
                {uniqueSupermarkets.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                title="Ofertas desde"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                title="Ofertas hasta"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
              >
                <option value="name">Nombre A-Z</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
                <option value="unitprice_asc">Precio unitario: menor a mayor</option>
              </select>
            </div>

            {/* Online Product Search */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <Globe className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 shrink-0">Búsqueda Online:</span>
                <div className="relative flex-1 min-w-[180px]">
                  <input
                    type="text"
                    placeholder="Ej: Leche, Arroz, Pan..."
                    value={onlineSearchQuery}
                    onChange={(e) => setOnlineSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && onlineSearchQuery.trim()) {
                        executeOnlineSearch(onlineSearchQuery);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                  />
                </div>
                <button
                  onClick={() => executeOnlineSearch(onlineSearchQuery)}
                  disabled={isSearchingOnline || !onlineSearchQuery.trim()}
                  className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-semibold px-4 py-2 rounded-xl transition active:scale-95 text-xs flex items-center gap-1.5"
                >
                  {isSearchingOnline ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  {isSearchingOnline ? "Buscando..." : "Buscar"}
                </button>
                {onlineSearchResults.length > 0 && (
                  <button
                    onClick={handleAddAllApiProductsToCatalog}
                    disabled={isSearchingOnline}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold px-4 py-2 rounded-xl transition active:scale-95 text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Todos
                  </button>
                )}
              </div>

              {/* Online search results list */}
              {onlineSearchResults.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {onlineSearchResults.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2 bg-sky-50/60 rounded-xl border border-sky-100">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-slate-700 block truncate">{item.productName}</span>
                        <span className="text-[11px] text-slate-400 block">
                          {item.shop} &middot; {formatUnitPrice(item.unitPrice, item.baseUnit || item.unit)}
                          {item.amount > 1 && ` (${item.amount} ${item.unit})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold text-sky-700">${item.price.toFixed(2)}</span>
                        <button
                          onClick={() => handleAddApiProductToCatalog(item)}
                          className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition active:scale-90"
                          title="Agregar al catálogo"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Catalog Layout: two columns on desktop (list + detail panel) */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Product List */}
            <div className="flex-1 min-w-0">
              {filteredProducts.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                  <p className="text-sm text-slate-500">No hay productos que coincidan con los filtros actuales.</p>
                </div>
              ) : (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {paginatedProducts.map(product => (
                    <div
                      key={product.id}
                      className={`bg-white rounded-2xl border shadow-sm p-4 transition cursor-pointer
                        ${selectedCompareProduct?.id === product.id ? 'ring-2 ring-sky-500 border-sky-300' : 'border-slate-100 hover:shadow-md hover:border-sky-200'}`}
                      onClick={() => setSelectedCompareProduct(selectedCompareProduct?.id === product.id ? null : product)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-bold text-slate-800 leading-tight line-clamp-2">{product.name}</h4>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); onCreateAlert(product.name, product.salePrice); }}
                            className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition active:scale-90"
                            title="Crear alerta de precio"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); addToShoppingList(product); }}
                            className="p-1.5 text-sky-500 hover:bg-sky-50 rounded-lg transition active:scale-90"
                            title="Agregar a la lista"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteProduct(product.id); }}
                            className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition active:scale-90"
                            title="Eliminar del catálogo"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 mb-2">
                        <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded">{translateCategory(product.category)}</span>
                        <span className="ml-1.5">{product.supermarket}</span>
                        {(() => {
                          const lowest = lowestPrices[product.name.toLowerCase().trim()];
                          if (lowest != null && product.salePrice <= lowest) {
                            return <span className="ml-1.5 inline-block bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Mejor precio</span>;
                          }
                          return null;
                        })()}
                      </p>

                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-lg font-extrabold text-emerald-700">${product.salePrice.toFixed(2)}</span>
                        {product.originalPrice > product.salePrice && (
                          <span className="text-xs text-slate-400 line-through">${product.originalPrice.toFixed(2)}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatUnitPrice(product.unitPrice, product.baseUnit || product.unit)}
                        {product.amount > 1 && ` (${product.amount} ${product.unit})`}
                      </p>
                      <p className="text-[10px] text-slate-300 mt-1">
                        {new Date(product.dateExtracted).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-xs">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1.5 rounded-lg border transition ${
                          p === safePage
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
                </>
              )}
            </div>

            {/* Detail / Comparison Side Panel (only visible when product selected) */}
            <div className="w-full lg:w-[340px] shrink-0">
              {selectedCompareProduct ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                  {/* Product Name / Category */}
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{selectedCompareProduct.name}</h4>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Store className="w-3 h-3" />
                      {selectedCompareProduct.supermarket}
                      <span className="ml-1.5 bg-slate-100 px-1.5 py-0.5 rounded">{translateCategory(selectedCompareProduct.category)}</span>
                    </p>
                  </div>

                  {/* Price highlight */}
                  <div className="p-3 bg-gradient-to-br from-sky-50 to-indigo-50/40 rounded-xl border border-sky-100">
                    <p className="text-xs text-sky-600 font-medium">Mejor precio disponible</p>
                    <p className="text-2xl font-black text-sky-800">${selectedCompareProduct.salePrice.toFixed(2)}</p>
                    <p className="text-[11px] text-sky-500">
                      {formatUnitPrice(selectedCompareProduct.unitPrice, selectedCompareProduct.baseUnit || selectedCompareProduct.unit)}
                      {selectedCompareProduct.amount > 1 && ` (${selectedCompareProduct.amount} ${selectedCompareProduct.unit})`}
                    </p>
                  </div>

                  {/* Price History Trend Chart */}
                  {productPriceHistory.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-xs font-bold text-slate-600">Historial de Precios</span>
                      </div>
                      <div className="bg-white border border-slate-100 rounded-xl p-2">
                        {(() => {
                          const prices = productPriceHistory.map(h => h.price);
                          const minP = Math.min(...prices);
                          const maxP = Math.max(...prices);
                          const range = maxP - minP || 1;
                          const w = 240;
                          const h = 80;
                          const points = productPriceHistory.map((entry, i) => {
                            const x = productPriceHistory.length > 1 ? (i / (productPriceHistory.length - 1)) * w : w / 2;
                            const y = h - ((entry.price - minP) / range) * (h - 12) - 6;
                            return { x, y, ...entry };
                          });
                          return (
                            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
                              <polyline
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="1.5"
                                points={points.map(p => `${p.x},${p.y}`).join(" ")}
                              />
                              {points.map((pt, i) => (
                                <g key={i}>
                                  <circle cx={pt.x} cy={pt.y} r="2.5" fill="#3b82f6" />
                                  <text x={pt.x} y={h - 2} textAnchor="middle" fontSize="7" fill="#94a3b8">
                                    {pt.date}
                                  </text>
                                  <text x={pt.x} y={pt.y - 5} textAnchor="middle" fontSize="7" fill="#475569" fontWeight="bold">
                                    ${pt.price.toFixed(2)}
                                  </text>
                                </g>
                              ))}
                            </svg>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Online Catalog Comparisons */}
                  {catalogComparisons.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Globe className="w-3.5 h-3.5 text-sky-500" />
                        <span className="text-xs font-bold text-slate-600">Comparación Online ({catalogComparisons.length})</span>
                      </div>
                      <p className="text-[10px] text-amber-600 mb-2">Precio de referencia — puede haber cambiado</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {catalogComparisons.map((cmp, i) => (
                          <div key={i} className="flex items-center justify-between px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{cmp.storeName}</p>
                              <p className="text-[10px] text-slate-400">
                                {formatUnitPrice(cmp.unitPrice, cmp.baseUnit || cmp.unit)}
                                {cmp.amount > 1 && ` (${cmp.amount} ${cmp.unit})`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-sm font-bold text-sky-700">${cmp.price.toFixed(2)}</span>
                              <button
                                onClick={() => {
                                  addToShoppingList({
                                    id: `api-${Date.now()}`,
                                    name: cmp.productName,
                                    category: selectedCompareProduct.category,
                                    originalPrice: cmp.price,
                                    salePrice: cmp.price,
                                    amount: cmp.amount,
                                    unit: cmp.unit,
                                    supermarket: cmp.storeName,
                                    dateExtracted: new Date().toISOString(),
                                    unitPrice: cmp.unitPrice,
                                    baseUnit: cmp.baseUnit || cmp.unit,
                                    sourceType: "online"
                                  });
                                }}
                                className="p-1.5 text-sky-500 hover:bg-sky-50 rounded-lg transition active:scale-90"
                                title="Agregar a lista de compras"
                              >
                                <ShoppingCart className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Close */}
                  <button
                    onClick={() => setSelectedCompareProduct(null)}
                    className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cerrar Detalle
                  </button>
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

          {/* Manual Entry Form Section */}
          <div className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              Agregar Producto Manualmente
            </h3>
            <form onSubmit={addManualProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Producto *</label>
                <input
                  type="text"
                  placeholder="Ej: Arroz Gallo"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Categoría</label>
                <select
                  value={customItemCategory}
                  onChange={(e) => setCustomItemCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                >
                  {["Produce", "Dairy", "Meat", "Pantry", "Bakery", "Beverages", "Frozen", "Cleaning", "Other"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Precio ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Cantidad</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="1"
                    value={customItemAmount}
                    onChange={(e) => setCustomItemAmount(e.target.value)}
                    className="w-20 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                  />
                  <select
                    value={customItemUnit}
                    onChange={(e) => setCustomItemUnit(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                  >
                    {["unit", "kg", "g", "l", "ml", "pack"].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Supermercado</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej: Día, Coto, Carrefour..."
                    value={customItemSupermarket}
                    onChange={(e) => setCustomItemSupermarket(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-xl shadow-sm transition active:scale-95 text-sm flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
});

export default CatalogTab;
