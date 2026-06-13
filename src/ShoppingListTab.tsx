import React from "react";
import { ShoppingCart, Check, Store, Sparkles, Trash, Calculator, Plus } from "lucide-react";
import { motion } from "motion/react";
import { ShoppingListItem } from "./types";
import { ShoppingListSuggestion } from "./gemini";
import { formatUnitPrice } from "./utils";
import { db } from "./db";

interface ShoppingListTabProps {
  shoppingList: ShoppingListItem[];
  suggestedItems: ShoppingListSuggestion[];
  isGeneratingSuggestions: boolean;
  receipts: any[];
  shoppingOptimization: any;
  clearList: () => void;
  toggleListItemChecked: (id: string) => void;
  updateListItemQuantity: (id: string, qty: number) => void;
  deleteListItem: (id: string) => void;
  handleAddSuggestedToShopping: (item: ShoppingListSuggestion) => void;
  handleGenerateAISuggestions: () => void;
  getLastPurchaseInfo: (itemName: string) => any;
  getBestAvailableOffer: (itemName: string, category: string) => any;
  setShoppingList: (list: ShoppingListItem[]) => void;
  triggerSuccess: (msg: string) => void;
}

const ShoppingListTab = React.memo(function ShoppingListTab({
  shoppingList,
  suggestedItems,
  isGeneratingSuggestions,
  receipts,
  shoppingOptimization,
  clearList,
  toggleListItemChecked,
  updateListItemQuantity,
  deleteListItem,
  handleAddSuggestedToShopping,
  handleGenerateAISuggestions,
  getLastPurchaseInfo,
  getBestAvailableOffer,
  setShoppingList,
  triggerSuccess,
}: ShoppingListTabProps) {
  return (
    <motion.div
      key="shopping-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-5xl mx-auto"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Shopping List Column */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-500/10 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-rose-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Lista de Compras</h2>
              {shoppingList.length > 0 && (
                <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {shoppingList.filter(i => i.checked).length}/{shoppingList.length}
                </span>
              )}
            </div>
            {shoppingList.length > 0 && (
              <button
                onClick={clearList}
                className="text-[11px] font-semibold text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition"
              >
                Vaciar Lista
              </button>
            )}
          </div>

          {shoppingList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
              <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Tu lista de compras está vacía</p>
              <p className="text-xs text-slate-400 mt-1">Agrega productos desde el catálogo para empezar a planificar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shoppingList.map(item => (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border shadow-sm p-4 transition
                    ${item.checked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100'}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleListItemChecked(item.id)}
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition
                        ${item.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-sky-400'}`}
                    >
                      {item.checked && <Check className="w-3 h-3" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${item.checked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {item.name}
                        </span>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Store className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{item.supermarket}</span>
                        <span className="text-xs font-bold text-emerald-700">${(item.price * item.quantity).toFixed(2)}</span>
                        {item.quantity > 1 && (
                          <span className="text-[10px] text-slate-400">(${item.price.toFixed(2)} c/u)</span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {formatUnitPrice(item.unitPrice, item.baseUnit || item.unit)}
                        </span>
                      </div>

                      {/* Purchase History / Best Offer Info (IIFE) */}
                      {(() => {
                        const lastPur = getLastPurchaseInfo(item.name);
                        const bestOffer = getBestAvailableOffer(item.name, item.category);
                        return (
                          <div className="mt-2 space-y-1 text-[11px] font-sans">
                            {lastPur && (
                              <div className="flex items-center gap-2 text-slate-500">
                                <span>Última compra: ${lastPur.totalPaidPrice.toFixed(2)} en {lastPur.store} ({lastPur.date})</span>
                              </div>
                            )}
                            {bestOffer && bestOffer.price < item.price && (
                              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                                <Store className="w-3 h-3" />
                                <span>
                                  Mejor oferta: <strong>${bestOffer.price.toFixed(2)}</strong> en {bestOffer.supermarket}
                                  {bestOffer.sourceType === "brochure" && bestOffer.endDate && (
                                    <span className="text-emerald-400"> (válido hasta {new Date(bestOffer.endDate).toLocaleDateString()})</span>
                                  )}
                                </span>
                                <button
                                  onClick={() => {
                                    const norm = { multiplier: 1, baseUnit: item.unit };
                                    const updatedItem = {
                                      ...item,
                                      price: bestOffer.price,
                                      supermarket: bestOffer.supermarket,
                                      unitPrice: bestOffer.price * norm.multiplier,
                                    };
                                    db.saveShoppingListItem(updatedItem);
                                    setShoppingList(db.getShoppingList());
                                    triggerSuccess(`Oferta aplicada: ${bestOffer.supermarket} - $${bestOffer.price.toFixed(2)}`);
                                  }}
                                  className="ml-auto text-emerald-600 hover:text-emerald-800 font-bold px-2 py-0.5 rounded hover:bg-emerald-100 transition text-[10px]"
                                >
                                  Aplicar Oferta
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateListItemQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center transition"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-slate-700">{item.quantity}</span>
                      <button
                        onClick={() => updateListItemQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center transition"
                      >
                        +
                      </button>
                      <button
                        onClick={() => deleteListItem(item.id)}
                        className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition ml-1"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Budget Optimizer Column */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {shoppingOptimization && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-lg p-5 text-white border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white/90">Optimizador Inteligente</h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
                  <span className="text-slate-400">Presupuesto Actual</span>
                  <span className="text-lg font-bold mt-0.5 text-slate-200">${shoppingOptimization.activeSelectedListTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
                  <span className="text-slate-400">Mejor Precio Global</span>
                  <span className="text-lg font-extrabold mt-0.5 text-emerald-400">${shoppingOptimization.absoluteCheapestCost.toFixed(2)}</span>
                </div>
                {shoppingOptimization.splitShoppingSavings > 0 && (
                  <>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-emerald-400 font-semibold">Ahorro Potencial</span>
                      <span className="text-base font-black text-emerald-400">
                        -${shoppingOptimization.splitShoppingSavings.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-emerald-400 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(shoppingOptimization.splitSavingsPct, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      SAVE {shoppingOptimization.splitSavingsPct.toFixed(0)}% comprando cada producto donde esté más barato.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {shoppingOptimization?.splitShoppingSavings > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h4 className="font-bold text-xs text-slate-600 uppercase tracking-wider mb-3">Plan de Compra Sugerido</h4>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {shoppingOptimization.splitShoppingPlan.map((planItem: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-700 truncate">{planItem.itemName}</p>
                      <p className="text-[10px] text-slate-400">
                        {planItem.originalMarket} → {planItem.bestMarket}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-bold text-emerald-600">${planItem.bestPrice.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400 line-through">${planItem.originalPrice.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shoppingOptimization && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h4 className="font-bold text-xs text-slate-600 uppercase tracking-wider mb-3">Comparativa por Tienda</h4>
              <div className="space-y-2">
                {shoppingOptimization.marketBudgets.map((budget: any, idx: number) => {
                  const isWorse = budget.totalCost > shoppingOptimization.activeSelectedListTotal;
                  return (
                    <div key={idx} className="flex items-center justify-between px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{budget.marketName}</p>
                        <p className="text-[10px] text-slate-400">{budget.matches} producto(s) cotejado(s)</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${isWorse ? 'text-rose-500' : 'text-emerald-600'}`}>
                          ${budget.totalCost.toFixed(2)}
                        </p>
                        {!isWorse && budget.totalCost > 0 && (
                          <p className="text-[10px] text-emerald-500">-{budget.percentSaved.toFixed(1)}%</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-700">Sugerencias IA</h3>
              </div>
              <button
                onClick={handleGenerateAISuggestions}
                disabled={isGeneratingSuggestions || receipts.length === 0}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-300 text-white font-semibold px-3 py-1.5 rounded-xl transition active:scale-95 text-[10px] flex items-center gap-1.5"
              >
                {isGeneratingSuggestions ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {isGeneratingSuggestions ? "Generando..." : "Generar Sugerencias"}
              </button>
            </div>

            {receipts.length === 0 && (
              <p className="text-[10px] text-slate-400 italic mb-3">
                Sube tickets en la pestaña "Historial y Tickets" para obtener recomendaciones automáticas de reposición.
              </p>
            )}

            {suggestedItems.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {suggestedItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-2.5 py-2 bg-amber-50 rounded-xl border border-amber-100">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.reason}</p>
                    </div>
                    <button
                      onClick={() => handleAddSuggestedToShopping(item)}
                      className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition active:scale-90"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default ShoppingListTab;
