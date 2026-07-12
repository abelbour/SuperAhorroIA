import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { Product } from "./types";

interface InflationTabProps {
  products: Product[];
  receiptsCount: number;
}

interface ProductPriceTrack {
  name: string;
  category: string;
  firstPrice: number;
  lastPrice: number;
  pctChange: number;
  occurrences: number;
  entries: { date: string; price: number; supermarket: string }[];
}

const Sparkline = React.memo(function Sparkline({ data, w = 80, h = 24 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ');
  const color = data[data.length - 1] >= data[0] ? '#f43f5e' : '#10b981';
  return (
    <svg width={w} height={h} className="shrink-0">
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

const InflationTab = React.memo(function InflationTab({ products, receiptsCount }: InflationTabProps) {
  const productTracks = useMemo((): ProductPriceTrack[] => {
    const groups: Record<string, ProductPriceTrack> = {};
    products.forEach(p => {
      const key = p.name.toLowerCase().trim();
      if (!groups[key]) {
        groups[key] = { name: p.name, category: p.category, firstPrice: p.salePrice, lastPrice: p.salePrice, pctChange: 0, occurrences: 0, entries: [] };
      }
      const g = groups[key];
      g.entries.push({ date: p.dateExtracted, price: p.salePrice, supermarket: p.supermarket });
      g.occurrences++;
    });
    return Object.values(groups).map(g => {
      g.entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      g.firstPrice = g.entries[0].price;
      g.lastPrice = g.entries[g.entries.length - 1].price;
      g.pctChange = g.firstPrice > 0 ? ((g.lastPrice - g.firstPrice) / g.firstPrice) * 100 : 0;
      return g;
    }).sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  }, [products]);

  const stats = useMemo(() => {
    const withHistory = productTracks.filter(t => t.occurrences >= 2);
    const up = withHistory.filter(t => t.pctChange > 1);
    const down = withHistory.filter(t => t.pctChange < -1);
    const stable = withHistory.filter(t => Math.abs(t.pctChange) <= 1);
    const avgChange = withHistory.length > 0 ? withHistory.reduce((s, t) => s + t.pctChange, 0) / withHistory.length : 0;
    const categoryMap: Record<string, { count: number; totalChange: number }> = {};
    productTracks.forEach(t => {
      if (!categoryMap[t.category]) categoryMap[t.category] = { count: 0, totalChange: 0 };
      categoryMap[t.category].count++;
      categoryMap[t.category].totalChange += t.pctChange;
    });
    const topInflation = Object.entries(categoryMap)
      .map(([cat, v]) => ({ category: cat, avgPct: v.totalChange / v.count, count: v.count }))
      .sort((a, b) => b.avgPct - a.avgPct);
    return { total: productTracks.length, withHistory: withHistory.length, up: up.length, down: down.length, stable: stable.length, avgChange, topInflation };
  }, [productTracks]);

  return (
    <motion.div
      key="inflation-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-4xl mx-auto flex flex-col gap-6"
    >
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-rose-500" />
          <h2 className="text-lg font-bold text-slate-800">Dashboard de Inflación</h2>
        </div>
        <p className="text-xs text-slate-500">Evolución de precios registrados en tu catálogo. Basado en {stats.total} productos únicos{stats.withHistory > 0 ? ` con ${stats.withHistory} seguimientos históricos` : ''} y {receiptsCount} tickets de compra.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold font-mono text-slate-700">{stats.total}</p>
            <p className="text-[10px] text-slate-400">Productos únicos</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold font-mono ${stats.avgChange > 0 ? 'text-rose-600' : stats.avgChange < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
              {stats.avgChange > 0 ? '+' : ''}{stats.avgChange.toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400">Variación promedio</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold font-mono text-rose-600">{stats.up}</p>
            <p className="text-[10px] text-rose-500">Subieron</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold font-mono text-emerald-600">{stats.down}</p>
            <p className="text-[10px] text-emerald-500">Bajaron</p>
          </div>
        </div>
      </div>

      {/* Inflación por categoría */}
      {stats.topInflation.length > 0 && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Inflación por Categoría</h3>
          <div className="space-y-2">
            {stats.topInflation.map(({ category, avgPct, count }) => (
              <div key={category} className="flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0 font-medium text-slate-600">{category}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${avgPct > 5 ? 'bg-rose-500' : avgPct > 0 ? 'bg-amber-500' : avgPct < -2 ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    style={{ width: `${Math.min(100, Math.abs(avgPct) * 3)}%` }} />
                </div>
                <span className={`w-16 text-right font-mono font-bold ${avgPct > 0 ? 'text-rose-600' : avgPct < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {avgPct > 0 ? '+' : ''}{avgPct.toFixed(1)}%
                </span>
                <span className="text-slate-400 w-8 text-right">({count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos con seguimiento */}
      {productTracks.length === 0 ? (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 text-xs text-slate-400">
          <AlertCircle className="w-4 h-4" />
          No hay suficientes datos de precios. Escaneá folletos o tickets en distintas fechas para ver la evolución.
        </div>
      ) : (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700">Evolución por Producto</h3>
            <span className="text-[10px] text-slate-400">Ordenado por cambio más significativo</span>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {productTracks.filter(t => t.occurrences >= 2).concat(productTracks.filter(t => t.occurrences < 2)).map(track => {
              const hasHistory = track.occurrences >= 2;
              const prices = track.entries.map(e => e.price);
              return (
                <div key={track.name} className={`flex items-center gap-3 p-2 rounded-xl text-xs ${hasHistory ? 'hover:bg-slate-50' : ''}`}>
                  <div className="w-20 shrink-0">
                    {hasHistory ? (
                      track.pctChange > 1 ? <TrendingUp className="w-3.5 h-3.5 text-rose-500" /> :
                      track.pctChange < -1 ? <TrendingDown className="w-3.5 h-3.5 text-emerald-500" /> :
                      <Minus className="w-3.5 h-3.5 text-slate-400" />
                    ) : <Minus className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-700 truncate">{track.name}</p>
                    <p className="text-[10px] text-slate-400">{track.category} · {track.occurrences} registro{track.occurrences !== 1 ? 's' : ''}</p>
                  </div>
                  {hasHistory && (
                    <>
                      <Sparkline data={prices} />
                      <div className="text-right w-24">
                        <p className="font-mono text-slate-600">${track.lastPrice.toFixed(0)}</p>
                        <p className={`text-[10px] font-mono font-bold ${track.pctChange > 0 ? 'text-rose-500' : track.pctChange < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {track.pctChange > 0 ? '+' : ''}{track.pctChange.toFixed(1)}%
                        </p>
                      </div>
                    </>
                  )}
                  {!hasHistory && (
                    <p className="text-[10px] text-slate-400 italic">1 solo registro</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
});

export default InflationTab;
