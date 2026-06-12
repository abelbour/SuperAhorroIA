import React, { useState } from "react";
import { Sparkles, Database, Globe, AlertCircle, Check } from "lucide-react";
import { StoreAnalysisResult } from "./types";
import { analyzeStoreForApi } from "./gemini";
import DebouncedInput from "./DebouncedInput";

interface Props {
  apiKey: string;
  onAcceptAnalysis: (analysis: StoreAnalysisResult) => void;
}

export default function StoreAnalyzerWizard({ apiKey, onAcceptAnalysis }: Props) {
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [analysis, setAnalysis] = useState<StoreAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!storeName.trim() || !storeUrl.trim()) {
      setError("Completa el nombre y la URL del supermercado.");
      return;
    }
    if (!apiKey) {
      setError("Se requiere una API Key de Gemini en Ajustes.");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeStoreForApi(storeName.trim(), storeUrl.trim(), apiKey);
      setAnalysis(result);
    } catch (err: any) {
      console.error("Store analysis failed:", err);
      setError(err.message || "Error al analizar la tienda.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
      <div className="border-b border-slate-100 pb-3 font-sans">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          Asistente de Configuración Inteligente
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Ingresa el nombre y la URL de un supermercado. La IA analizará su sitio web y determinará automáticamente la mejor forma de obtener precios (API pública o búsqueda web).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="sm:col-span-1">
          <label className="block text-slate-600 font-semibold mb-1">Nombre del Supermercado</label>
          <DebouncedInput
            type="text" placeholder="Ej: Carrefour, Coto, Día"
            value={storeName}
            onChange={setStoreName}
            className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-slate-600 font-semibold mb-1">URL del Sitio Web</label>
          <DebouncedInput
            type="text" placeholder="Ej: https://www.carrefour.com.ar"
            value={storeUrl}
            onChange={setStoreUrl}
            className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-1 flex items-end">
          <button onClick={handleAnalyze} disabled={isAnalyzing}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-2 px-4 rounded-xl transition active:scale-95 shadow cursor-pointer text-xs flex items-center gap-1">
            {isAnalyzing ? "Analizando..." : "🔍 Analizar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-sans flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {isAnalyzing && (
        <div className="text-xs text-slate-500 font-sans flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          Analizando {storeName}...
        </div>
      )}

      {analysis && (
        <div className="space-y-3 font-sans">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800">{analysis.storeName}</h4>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  analysis.methodType === "api" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  analysis.methodType === "scrape" ? "bg-sky-50 text-sky-700 border-sky-200" :
                  "bg-slate-50 text-slate-500 border-slate-200"
                }`}>
                  {analysis.methodType === "api" ? "API" : analysis.methodType === "scrape" ? "Búsqueda Web" : "No disponible"}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  analysis.confidence === "high" ? "bg-emerald-100 text-emerald-800" :
                  analysis.confidence === "medium" ? "bg-amber-100 text-amber-800" :
                  "bg-rose-100 text-rose-800"
                }`}>
                  {analysis.confidence === "high" ? "Alta confianza" : analysis.confidence === "medium" ? "Confianza media" : "Confianza baja"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              {analysis.methodType === "api" ? (
                <Database className="w-4 h-4 text-emerald-500" />
              ) : analysis.methodType === "scrape" ? (
                <Globe className="w-4 h-4 text-sky-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-xs text-slate-600">
                {analysis.methodType === "api" ? "API configurada automáticamente" :
                 analysis.methodType === "scrape" ? "Búsqueda web configurada" :
                 "No se encontró un método compatible"}
              </span>
            </div>

            {analysis.methodType === "api" && analysis.apiConfig && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div><span className="text-slate-500">Método:</span> <span className="text-slate-800">{analysis.apiConfig.method}</span></div>
                <div><span className="text-slate-500">URL:</span> <span className="text-slate-800 break-all">{analysis.apiConfig.url}</span></div>
                {analysis.apiConfig.queryParams && <div><span className="text-slate-500">Query Params:</span> <span className="text-emerald-700">{analysis.apiConfig.queryParams}</span></div>}
                {analysis.apiConfig.responseJsonPath && <div><span className="text-slate-500">JSON Path:</span> <span className="text-emerald-700">{analysis.apiConfig.responseJsonPath}</span></div>}
                {analysis.apiConfig.headers && <div><span className="text-slate-500">Headers:</span> <span className="text-emerald-700">{analysis.apiConfig.headers}</span></div>}
              </div>
            )}

            {analysis.methodType === "scrape" && analysis.scrapeConfig && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div><span className="text-slate-500">URL Template:</span> <span className="text-slate-800 break-all">{analysis.scrapeConfig.searchUrlTemplate}</span></div>
                {analysis.scrapeConfig.cssSelectors && <div><span className="text-slate-500">CSS Selectors:</span> <span className="text-sky-700">{analysis.scrapeConfig.cssSelectors}</span></div>}
                {analysis.scrapeConfig.notes && <div><span className="text-slate-500">Notas:</span> <span className="text-amber-700">{analysis.scrapeConfig.notes}</span></div>}
              </div>
            )}

            <div className="mt-3 text-xs text-slate-600 leading-relaxed font-sans">{analysis.analysis}</div>
            {analysis.tips && <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100 font-sans">{analysis.tips}</div>}
          </div>

          {analysis.methodType !== "unsupported" && (
            <button onClick={() => onAcceptAnalysis(analysis)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl transition active:scale-95 shadow cursor-pointer text-xs flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Aceptar y Configurar Catálogo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
