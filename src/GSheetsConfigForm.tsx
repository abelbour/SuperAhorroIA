import React, { useState, useEffect } from "react";
import { RefreshCw, Check, AlertCircle, Share2, FileSpreadsheet } from "lucide-react";
import DebouncedInput from "./DebouncedInput";
import { getPublicProxies, setPublicProxies } from "./utils";

interface Props {
  gsheetsUrl: string;
  gsheetsSSID: string;
  gsheetsEnabled: boolean;
  isSyncing: boolean;
  syncStatus: "success" | "error" | null;
  syncMessage: string;
  onToggleEnabled: (val: boolean) => void;
  onSync: (url: string, ssid: string) => void;
  onShare: () => void;
}

export default function GSheetsConfigForm({
  gsheetsUrl: propUrl, gsheetsSSID: propSsid, gsheetsEnabled,
  isSyncing, syncStatus, syncMessage,
  onToggleEnabled, onSync, onShare }: Props) {

  const [localUrl, setLocalUrl] = useState(propUrl);
  const [localSsid, setLocalSsid] = useState(propSsid);
  const [proxyUrlsText, setProxyUrlsText] = useState(getPublicProxies().join("\n"));

  useEffect(() => { setLocalUrl(propUrl); }, [propUrl]);
  useEffect(() => { setLocalSsid(propSsid); }, [propSsid]);

  const handleSync = () => {
    onSync(localUrl, localSsid);
  };

  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
          <h3 className="text-base font-bold text-slate-800">Google Sheets Sync</h3>
        </div>
        <div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={gsheetsEnabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-2 text-xs font-semibold text-slate-700">Activo</span>
          </label>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-600 font-bold mb-1">ID de Google Sheet (SSID) *</label>
            <DebouncedInput
              type="text" placeholder="Ej: 1A2b3c4D5e6F7g8H9i0J_kLmNoP"
              value={localSsid}
              onChange={setLocalSsid}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-bold mb-1">URL de la Web App de Apps Script (GAS) *</label>
            <DebouncedInput
              type="text" placeholder="Ej: https://script.google.com/macros/s/AKfycb.../exec"
              value={localUrl}
              onChange={setLocalUrl}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleSync} disabled={isSyncing || !gsheetsEnabled}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer text-xs">
            {isSyncing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Sincronizando...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Sincronizar y Fusionar con Sheets</>
            )}
          </button>
          <button onClick={onShare} disabled={!localSsid && !localUrl}
            className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 border border-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer text-xs"
            title="Copiar enlace con SSID y URL de GAS para acceder directamente o compartir su configuración">
            <Share2 className="w-4 h-4 text-slate-500" /> Compartir Enlace
          </button>
        </div>

        {syncMessage && (
          <div className={`p-3 rounded-xl border flex items-start gap-2 ${
            syncStatus === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-800" :
            syncStatus === "error" ? "bg-rose-50 border-rose-100 text-rose-800" :
            "bg-blue-50 border-blue-100 text-blue-800"
          }`}>
            {syncStatus === "success" ? <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> :
             syncStatus === "error" ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /> :
             <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 animate-spin mt-0.5" />}
            <div>
              <span className="font-semibold block text-xs">Estado de Sincronización</span>
              <p className="text-[11px] mt-0.5 leading-relaxed">{syncMessage}</p>
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              defaultChecked={localStorage.getItem("bp_gsheets_proxy_enabled") !== "false"}
              onChange={(e) => localStorage.setItem("bp_gsheets_proxy_enabled", String(e.target.checked))}
              className="w-4 h-4 accent-emerald-600" />
            <span className="text-xs text-slate-700 font-medium">Usar Google Sheets como proxy para APIs sin CORS</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              defaultChecked={localStorage.getItem("bp_public_proxy_enabled") !== "false"}
              onChange={(e) => localStorage.setItem("bp_public_proxy_enabled", String(e.target.checked))}
              className="w-4 h-4 accent-amber-500" />
            <span className="text-xs text-slate-700 font-medium">Usar proxies públicos de respaldo (corsproxy.io, allorigins)</span>
          </label>
          <textarea
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono mt-1"
            rows={2}
            placeholder="Una URL por línea, con {url} como placeholder"
            value={proxyUrlsText}
            onChange={(e) => {
              setProxyUrlsText(e.target.value);
              setPublicProxies(e.target.value.split("\n").map(s => s.trim()).filter(Boolean));
            }}
          />
        </div>
      </div>
    </div>
  );
}
