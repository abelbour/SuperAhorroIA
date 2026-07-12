import React, { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import {
  Database, Package, Receipt, ShoppingCart, AlertTriangle, Upload, HardDrive,
  Download, Upload as UploadIcon, Trash, Search, Eye, EyeOff, Archive,
  X, Check, ChevronLeft, ChevronRight, RefreshCw
} from "lucide-react";
import type { Product, Receipt, ShoppingListItem, PriceAlert, BroshureUpload } from "./types";
import { db } from "./db";
import { formatUnitPrice, translateCategory, isProductVigente } from "./utils";

type SubTab = "products" | "receipts" | "shopping" | "alerts" | "uploads" | "storage";

interface DataManagerTabProps {
  products: Product[];
  setProducts: (v: Product[]) => void;
  receipts: Receipt[];
  setReceipts: (v: Receipt[]) => void;
  shoppingList: ShoppingListItem[];
  setShoppingList: (v: ShoppingListItem[]) => void;
  triggerSuccess: (msg: string) => void;
  triggerError: (msg: string) => void;
}

const ITEMS_PER_PAGE = 25;

function DataManagerTab({
  products,
  setProducts,
  receipts,
  setReceipts,
  shoppingList,
  setShoppingList,
  triggerSuccess,
  triggerError,
}: DataManagerTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("products");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [showArchived, setShowArchived] = useState(false);

  const freshnessDays = db.getFreshnessDays();

  // Estimated localStorage usage
  const storageEstimate = useMemo(() => {
    let total = 0;
    for (const key of Object.keys(localStorage)) {
      const val = localStorage.getItem(key);
      if (val) total += val.length * 2; // UTF-16
    }
    return {
      used: total,
      usedStr: total > 1048576 ? `${(total / 1048576).toFixed(1)} MB` : `${(total / 1024).toFixed(0)} KB`,
      limit: 5242880,
      limitStr: "5 MB",
    };
  }, [products, receipts, shoppingList]);

  const filtered = useMemo(() => {
    let list: Product[];
    if (subTab === "products") {
      list = products;
    } else if (subTab === "receipts") {
      return receipts;
    } else if (subTab === "shopping") {
      return shoppingList;
    } else if (subTab === "alerts") {
      return db.getAlerts();
    } else {
      return db.getUploads();
    }
    if (subTab !== "products") return list!;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.supermarket.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    if (!showArchived) {
      list = list.filter(p => !p.archived);
    }
    return list.sort((a, b) => new Date(b.dateExtracted).getTime() - new Date(a.dateExtracted).getTime());
  }, [subTab, search, products, receipts, shoppingList, showArchived]);

  const totalPages = Math.max(1, Math.ceil((filtered as any[]).length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = (filtered as any[]).slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [subTab, search, showArchived]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((i: any) => i.id)));
    }
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (subTab === "products") {
      selectedIds.forEach(id => db.deleteProduct(id));
      setProducts(db.getProducts());
      triggerSuccess(`${selectedIds.size} producto(s) eliminado(s).`);
    } else if (subTab === "receipts") {
      selectedIds.forEach(id => db.deleteReceipt(id));
      setReceipts(db.getReceipts());
      triggerSuccess(`${selectedIds.size} ticket(s) eliminado(s).`);
    } else if (subTab === "shopping") {
      selectedIds.forEach(id => db.deleteShoppingListItem(id));
      setShoppingList(db.getShoppingList());
      triggerSuccess(`${selectedIds.size} item(s) eliminado(s).`);
    } else if (subTab === "alerts") {
      selectedIds.forEach(id => db.deleteAlert(id));
      triggerSuccess(`${selectedIds.size} alerta(s) eliminada(s).`);
    } else if (subTab === "uploads") {
      selectedIds.forEach(id => db.deleteUpload(id));
      setProducts(db.getProducts());
      triggerSuccess(`${selectedIds.size} carga(s) eliminada(s).`);
    }
    setSelectedIds(new Set());
  };

  const archiveSelected = () => {
    if (selectedIds.size === 0 || subTab !== "products") return;
    selectedIds.forEach(id => {
      const p = products.find(x => x.id === id);
      if (p) {
        const updated = { ...p, archived: true };
        db.saveProduct(updated);
      }
    });
    setProducts(db.getProducts());
    triggerSuccess(`${selectedIds.size} producto(s) archivado(s).`);
    setSelectedIds(new Set());
  };

  const unarchiveProduct = (id: string) => {
    const p = products.find(x => x.id === id);
    if (p) {
      db.saveProduct({ ...p, archived: false });
      setProducts(db.getProducts());
      triggerSuccess("Producto restaurado.");
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      category: p.category,
      salePrice: p.salePrice,
      originalPrice: p.originalPrice,
      amount: p.amount,
      unit: p.unit,
      supermarket: p.supermarket,
      endDate: p.endDate,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const original = products.find(p => p.id === editingId);
    if (!original) return;
    db.saveProduct({ ...original, ...editForm });
    setProducts(db.getProducts());
    setEditingId(null);
    triggerSuccess("Producto actualizado.");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Export/Import
  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      products: db.getProducts(),
      receipts: db.getReceipts(),
      shoppingList: db.getShoppingList(),
      savedLists: db.getSavedLists(),
      uploads: db.getUploads(),
      alerts: db.getAlerts(),
      catalogSources: db.getCatalogSources(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `superahorro_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerSuccess("Base de datos exportada.");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.products && !data.receipts) {
          triggerError("El archivo no tiene datos válidos.");
          return;
        }
        if (data.products?.length) db.saveProducts(data.products);
        if (data.receipts?.length) data.receipts.forEach((r: Receipt) => db.saveReceipt(r));
        if (data.shoppingList?.length) db.saveShoppingList(data.shoppingList);
        if (data.uploads?.length) data.uploads.forEach((u: BroshureUpload) => db.saveUpload(u));
        if (data.alerts?.length) data.alerts.forEach((a: PriceAlert) => db.saveAlert(a));
        setProducts(db.getProducts());
        setReceipts(db.getReceipts());
        setShoppingList(db.getShoppingList());
        triggerSuccess(`${data.products?.length || 0} productos, ${data.receipts?.length || 0} tickets importados.`);
      } catch (err: any) {
        triggerError(`Error al importar: ${err.message}`);
      }
    };
    input.click();
  };

  const clearTable = (table: string) => {
    if (table === "products") { db.clearAllProducts(); setProducts([]); }
    else if (table === "receipts") { db.clearReceipts(); setReceipts([]); }
    else if (table === "shopping") { db.clearShoppingList(); setShoppingList([]); }
    else if (table === "alerts") { db.clearAlerts(); }
    else if (table === "uploads") { db.clearUploads(); }
    else if (table === "savedlists") { db.clearSavedLists(); }
    else if (table === "sources") { db.clearCatalogSources(); }
    triggerSuccess(`Tabla "${table}" limpiada.`);
    setSelectedIds(new Set());
  };

  const renderPagination = (total: number) => {
    if (total <= ITEMS_PER_PAGE) return null;
    const tp = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
    return (
      <div className="flex items-center justify-center gap-2 mt-4 text-xs">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-slate-500">Página {safePage} de {tp}</span>
        <button onClick={() => setPage(p => Math.min(tp, p + 1))} disabled={safePage >= tp}
          className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const vigenciaBadge = (p: Product) => {
    if (p.archived) return <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Archivado</span>;
    if (p.sourceType === "brochure" && p.endDate && new Date(p.endDate) < new Date()) return <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">Vencido</span>;
    if (!isProductVigente(p, new Date(), freshnessDays)) return <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">Histórico</span>;
    return <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Vigente</span>;
  };

  const subTabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: "products", label: "Productos", icon: <Package className="w-3.5 h-3.5" /> },
    { key: "receipts", label: "Tickets", icon: <Receipt className="w-3.5 h-3.5" /> },
    { key: "shopping", label: "Lista", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
    { key: "alerts", label: "Alertas", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { key: "uploads", label: "Cargas", icon: <Upload className="w-3.5 h-3.5" /> },
    { key: "storage", label: "Almacenamiento", icon: <HardDrive className="w-3.5 h-3.5" /> },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Database className="w-5 h-5 text-sky-600" />
        <h2 className="text-lg font-bold text-slate-800">Gestor de Base de Datos</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {subTabs.map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
              subTab === st.key ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {st.icon}
            {st.label}
          </button>
        ))}
      </div>

      {/* Search + Bulk Actions (for list views) */}
      {subTab !== "storage" && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input type="text" placeholder="Buscar..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 transition" />
          </div>
          {subTab === "products" && (
            <button onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition ${
                showArchived ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-white border-slate-200 text-slate-500'
              }`}>
              {showArchived ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showArchived ? "Mostrando archivados" : "Ocultar archivados"}
            </button>
          )}
          {selectedIds.size > 0 && (
            <>
              <button onClick={deleteSelected}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-medium hover:bg-rose-600 transition">
                <Trash className="w-3.5 h-3.5" />
                Eliminar ({selectedIds.size})
              </button>
              {subTab === "products" && (
                <button onClick={archiveSelected}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-600 text-white text-xs font-medium hover:bg-slate-700 transition">
                  <Archive className="w-3.5 h-3.5" />
                  Archivar ({selectedIds.size})
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* === PRODUCTS === */}
      {subTab === "products" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <th className="p-2 text-left w-8">
                  <input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0}
                    onChange={selectAll} className="w-3.5 h-3.5 accent-sky-600" />
                </th>
                <th className="p-2 text-left font-medium">Producto</th>
                <th className="p-2 text-left font-medium">Supermercado</th>
                <th className="p-2 text-right font-medium">Precio</th>
                <th className="p-2 text-right font-medium">Cant.</th>
                <th className="p-2 text-center font-medium">Estado</th>
                <th className="p-2 text-center font-medium w-20">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(paginated as Product[]).map(p => (
                <tr key={p.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition ${p.archived ? 'opacity-60' : ''}`}>
                  <td className="p-2">
                    <input type="checkbox" checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)} className="w-3.5 h-3.5 accent-sky-600" />
                  </td>
                  <td className="p-2">
                    {editingId === p.id ? (
                      <input value={editForm.name || ""} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-2 py-1 rounded border border-sky-200 text-xs" />
                    ) : (
                      <span className="font-medium text-slate-800">{p.name}</span>
                    )}
                  </td>
                  <td className="p-2 text-slate-500">
                    {editingId === p.id ? (
                      <input value={editForm.supermarket || ""} onChange={(e) => setEditForm(f => ({ ...f, supermarket: e.target.value }))}
                        className="w-full px-2 py-1 rounded border border-sky-200 text-xs" />
                    ) : p.supermarket}
                  </td>
                  <td className="p-2 text-right font-semibold text-emerald-700">
                    {editingId === p.id ? (
                      <input type="number" step="0.01" value={editForm.salePrice ?? ""} onChange={(e) => setEditForm(f => ({ ...f, salePrice: parseFloat(e.target.value) || 0 }))}
                        className="w-20 px-2 py-1 rounded border border-sky-200 text-xs text-right" />
                    ) : `$${p.salePrice.toFixed(2)}`}
                  </td>
                  <td className="p-2 text-right text-slate-400">
                    {editingId === p.id ? (
                      <div className="flex gap-1">
                        <input type="number" step="0.1" value={editForm.amount ?? ""} onChange={(e) => setEditForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                          className="w-14 px-2 py-1 rounded border border-sky-200 text-xs text-right" />
                        <select value={editForm.unit || "units"} onChange={(e) => setEditForm(f => ({ ...f, unit: e.target.value }))}
                          className="px-1 py-1 rounded border border-sky-200 text-xs">
                          <option value="g">g</option><option value="kg">kg</option>
                          <option value="ml">ml</option><option value="L">L</option>
                          <option value="units">unidades</option>
                        </select>
                      </div>
                    ) : `${p.amount} ${p.unit}`}
                  </td>
                  <td className="p-2 text-center">{vigenciaBadge(p)}</td>
                  <td className="p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === p.id ? (
                        <>
                          <button onClick={saveEdit} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition" title="Guardar">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded transition" title="Cancelar">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(p)} className="p-1 text-sky-500 hover:bg-sky-50 rounded transition" title="Editar">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          {p.archived && (
                            <button onClick={() => unarchiveProduct(p.id)} className="p-1 text-amber-500 hover:bg-amber-50 rounded transition" title="Restaurar">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(paginated as Product[]).length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-sm">No hay productos.</td></tr>
              )}
            </tbody>
          </table>
          {renderPagination((filtered as Product[]).length)}
        </div>
      )}

      {/* === RECEIPTS === */}
      {subTab === "receipts" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <th className="p-2 text-left w-8"><input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0}
                  onChange={selectAll} className="w-3.5 h-3.5 accent-sky-600" /></th>
                <th className="p-2 text-left font-medium">Tienda</th>
                <th className="p-2 text-left font-medium">Fecha</th>
                <th className="p-2 text-right font-medium">Total</th>
                <th className="p-2 text-center font-medium">Artículos</th>
              </tr>
            </thead>
            <tbody>
              {(paginated as Receipt[]).map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="p-2"><input type="checkbox" checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelect(r.id)} className="w-3.5 h-3.5 accent-sky-600" /></td>
                  <td className="p-2 font-medium text-slate-800">{r.store}</td>
                  <td className="p-2 text-slate-500">{r.date}</td>
                  <td className="p-2 text-right font-semibold text-emerald-700">${r.totalAmount.toFixed(2)}</td>
                  <td className="p-2 text-center text-slate-400">{r.items.length}</td>
                </tr>
              ))}
              {(paginated as Receipt[]).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-sm">No hay tickets.</td></tr>
              )}
            </tbody>
          </table>
          {renderPagination((filtered as Receipt[]).length)}
        </div>
      )}

      {/* === SHOPPING LIST === */}
      {subTab === "shopping" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <th className="p-2 text-left w-8"><input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0}
                  onChange={selectAll} className="w-3.5 h-3.5 accent-sky-600" /></th>
                <th className="p-2 text-left font-medium">Producto</th>
                <th className="p-2 text-left font-medium">Supermercado</th>
                <th className="p-2 text-right font-medium">Precio</th>
                <th className="p-2 text-right font-medium">Cant.</th>
              </tr>
            </thead>
            <tbody>
              {(paginated as ShoppingListItem[]).map(item => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="p-2"><input type="checkbox" checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)} className="w-3.5 h-3.5 accent-sky-600" /></td>
                  <td className="p-2 font-medium text-slate-800">{item.name}</td>
                  <td className="p-2 text-slate-500">{item.supermarket}</td>
                  <td className="p-2 text-right font-semibold text-emerald-700">${item.price.toFixed(2)}</td>
                  <td className="p-2 text-right text-slate-400">{item.quantity} x {item.amount} {item.unit}</td>
                </tr>
              ))}
              {(paginated as ShoppingListItem[]).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-sm">Lista de compras vacía.</td></tr>
              )}
            </tbody>
          </table>
          {renderPagination((filtered as ShoppingListItem[]).length)}
        </div>
      )}

      {/* === ALERTS === */}
      {subTab === "alerts" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <th className="p-2 text-left w-8"><input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0}
                  onChange={selectAll} className="w-3.5 h-3.5 accent-sky-600" /></th>
                <th className="p-2 text-left font-medium">Producto</th>
                <th className="p-2 text-right font-medium">Precio objetivo</th>
                <th className="p-2 text-right font-medium">Mejor precio</th>
                <th className="p-2 text-center font-medium">Activa</th>
              </tr>
            </thead>
            <tbody>
              {(paginated as PriceAlert[]).map(a => (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="p-2"><input type="checkbox" checked={selectedIds.has(a.id)}
                    onChange={() => toggleSelect(a.id)} className="w-3.5 h-3.5 accent-sky-600" /></td>
                  <td className="p-2 font-medium text-slate-800">{a.productName}</td>
                  <td className="p-2 text-right text-slate-500">${a.targetPrice.toFixed(2)}</td>
                  <td className="p-2 text-right text-slate-500">${a.currentBestPrice.toFixed(2)}</td>
                  <td className="p-2 text-center">{a.active ? <span className="text-emerald-500 text-xs">Sí</span> : <span className="text-slate-300 text-xs">No</span>}</td>
                </tr>
              ))}
              {(paginated as PriceAlert[]).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-sm">No hay alertas.</td></tr>
              )}
            </tbody>
          </table>
          {renderPagination((filtered as PriceAlert[]).length)}
        </div>
      )}

      {/* === UPLOADS === */}
      {subTab === "uploads" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <th className="p-2 text-left w-8"><input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0}
                  onChange={selectAll} className="w-3.5 h-3.5 accent-sky-600" /></th>
                <th className="p-2 text-left font-medium">Archivo</th>
                <th className="p-2 text-left font-medium">Supermercado</th>
                <th className="p-2 text-center font-medium">Estado</th>
                <th className="p-2 text-right font-medium">Artículos</th>
              </tr>
            </thead>
            <tbody>
              {(paginated as BroshureUpload[]).map(u => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="p-2"><input type="checkbox" checked={selectedIds.has(u.id)}
                    onChange={() => toggleSelect(u.id)} className="w-3.5 h-3.5 accent-sky-600" /></td>
                  <td className="p-2 font-medium text-slate-800 truncate max-w-[200px]">{u.fileName}</td>
                  <td className="p-2 text-slate-500">{u.supermarket}</td>
                  <td className="p-2 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      u.status === "completed" ? 'bg-emerald-100 text-emerald-700' :
                      u.status === "failed" ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                    }`}>{u.status}</span>
                  </td>
                  <td className="p-2 text-right text-slate-400">{u.itemCount}</td>
                </tr>
              ))}
              {(paginated as BroshureUpload[]).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-sm">No hay cargas.</td></tr>
              )}
            </tbody>
          </table>
          {renderPagination((filtered as BroshureUpload[]).length)}
        </div>
      )}

      {/* === STORAGE === */}
      {subTab === "storage" && (
        <div className="space-y-6">
          {/* Storage usage gauge */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-sky-500" />
              Uso de Almacenamiento Local
            </h3>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (storageEstimate.used / storageEstimate.limit) * 100)}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {storageEstimate.usedStr} usado de {storageEstimate.limitStr}
              <span className="ml-2 text-slate-300">
                ({((storageEstimate.used / storageEstimate.limit) * 100).toFixed(0)}%)
              </span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="font-bold text-slate-800">{products.length}</p>
                <p className="text-slate-400">Productos</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="font-bold text-slate-800">{receipts.length}</p>
                <p className="text-slate-400">Tickets</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="font-bold text-slate-800">{shoppingList.length}</p>
                <p className="text-slate-400">Lista</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="font-bold text-slate-800">{db.getAlerts().length}</p>
                <p className="text-slate-400">Alertas</p>
              </div>
            </div>
          </div>

          {/* Import/Export */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Importar / Exportar</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition">
                <Download className="w-4 h-4" />
                Exportar DB (.json)
              </button>
              <button onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition">
                <UploadIcon className="w-4 h-4" />
                Importar DB (.json)
              </button>
            </div>
          </div>

          {/* Clear tables */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-3 text-rose-600">Limpiar tablas</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "products", label: "Productos" },
                { key: "receipts", label: "Tickets" },
                { key: "shopping", label: "Lista de compras" },
                { key: "alerts", label: "Alertas" },
                { key: "uploads", label: "Cargas" },
                { key: "savedlists", label: "Listas guardadas" },
                { key: "sources", label: "Fuentes API" },
              ].map(t => (
                <button key={t.key} onClick={() => clearTable(t.key)}
                  className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-medium transition">
                  <Trash className="w-3 h-3 inline mr-1" />
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Estas acciones son irreversibles.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default DataManagerTab;
