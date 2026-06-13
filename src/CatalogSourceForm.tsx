import React, { useState, useEffect } from "react";
import { Save, Trash, Sparkles } from "lucide-react";
import { CatalogSource } from "./types";

interface Props {
  initialData: CatalogSource | null;
  interpretingId: string | null;
  onSave: (source: CatalogSource) => void;
  onDelete: (id: string, name: string) => void;
  onCancel: () => void;
  onInterpret: (source: CatalogSource) => void;
}

export default function CatalogSourceForm({ initialData, interpretingId, onSave, onDelete, onCancel, onInterpret }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [searchUrlTemplate, setSearchUrlTemplate] = useState("");
  const [aiInterpretation, setAiInterpretation] = useState("");
  const [siteSearchEnabled, setSiteSearchEnabled] = useState(true);
  const [searchMethod, setSearchMethod] = useState<"api" | "scrape" | "none">("none");
  const [apiMethod, setApiMethod] = useState<"GET" | "POST">("GET");
  const [apiUrl, setApiUrl] = useState("");
  const [apiHeadersJson, setApiHeadersJson] = useState("");
  const [apiQueryParamsJson, setApiQueryParamsJson] = useState("");
  const [apiBodyTemplate, setApiBodyTemplate] = useState("");
  const [apiResponseJsonPath, setApiResponseJsonPath] = useState("");
  const [apiCorsProxyUrl, setApiCorsProxyUrl] = useState("");
  const [apiDefaultCategory, setApiDefaultCategory] = useState("Other");
  const [scrapeNotes, setScrapeNotes] = useState("");

  // Location fields
  const [salesChannel, setSalesChannel] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Session fields
  const [sessionMethod, setSessionMethod] = useState<"none" | "form">("none");
  const [sessionLoginUrl, setSessionLoginUrl] = useState("");
  const [sessionLoginFieldsJson, setSessionLoginFieldsJson] = useState("");
  const [sessionCaptchaSiteKey, setSessionCaptchaSiteKey] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setWebsiteUrl(initialData.websiteUrl || "");
      setSearchUrlTemplate(initialData.searchUrlTemplate || "");
      setAiInterpretation(initialData.aiInterpretation || "");
      setSiteSearchEnabled(initialData.siteSearchEnabled !== false);
      setSearchMethod(initialData.searchMethod || "none");
      setApiMethod(initialData.apiMethod || "GET");
      setApiUrl(initialData.apiUrl || "");
      setApiHeadersJson(initialData.apiHeaders ? JSON.stringify(initialData.apiHeaders, null, 2) : "");
      setApiQueryParamsJson(initialData.apiQueryParams ? JSON.stringify(initialData.apiQueryParams, null, 2) : "");
      setApiBodyTemplate(initialData.apiBodyTemplate || "");
      setApiResponseJsonPath(initialData.apiResponseJsonPath || "");
      setApiCorsProxyUrl(initialData.apiCorsProxyUrl || "");
      setApiDefaultCategory(initialData.apiDefaultCategory || "Other");
      setScrapeNotes(initialData.scrapeNotes || "");
      setSalesChannel(initialData.salesChannel || "");
      setPostalCode(initialData.postalCode || "");
      setSessionMethod(initialData.sessionMethod || "none");
      setSessionLoginUrl(initialData.sessionLoginUrl || "");
      setSessionLoginFieldsJson(initialData.sessionLoginFields ? JSON.stringify(initialData.sessionLoginFields, null, 2) : "");
      setSessionCaptchaSiteKey(initialData.sessionCaptchaSiteKey || "");
    }
  }, [initialData]);

  const handleSave = () => {
    if (!name.trim()) return;

    let parsedHeaders: Record<string, string> | undefined;
    let parsedQueryParams: Record<string, string> | undefined;
    let parsedSessionFields: Record<string, string> | undefined;
    try { if (apiHeadersJson.trim()) parsedHeaders = JSON.parse(apiHeadersJson.trim()); } catch {}
    try { if (apiQueryParamsJson.trim()) parsedQueryParams = JSON.parse(apiQueryParamsJson.trim()); } catch {}
    try { if (sessionLoginFieldsJson.trim()) parsedSessionFields = JSON.parse(sessionLoginFieldsJson.trim()); } catch {}

    const source: CatalogSource = {
      ...(initialData ? { id: initialData.id } : { id: `cat-${Date.now()}` }),
      name: name.trim(),
      description: description.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      searchUrlTemplate: searchUrlTemplate.trim() || undefined,
      aiInterpretation: aiInterpretation || undefined,
      siteSearchEnabled,
      searchMethod: searchMethod,
      salesChannel: salesChannel.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      sessionMethod: sessionMethod === "form" ? "form" : "none",
      sessionLoginUrl: sessionLoginUrl.trim() || undefined,
      sessionLoginFields: parsedSessionFields,
      sessionCaptchaSiteKey: sessionCaptchaSiteKey.trim() || undefined,
      ...(searchMethod === "api" ? {
        apiMethod,
        apiUrl: apiUrl.trim() || undefined,
        apiHeaders: parsedHeaders,
        apiQueryParams: parsedQueryParams,
        apiBodyTemplate: apiBodyTemplate.trim() || undefined,
        apiResponseJsonPath: apiResponseJsonPath.trim() || undefined,
        apiCorsProxyUrl: apiCorsProxyUrl.trim() || undefined,
        apiDefaultCategory: apiDefaultCategory || "Other",
        scrapeNotes: undefined,
      } : {
        apiMethod: undefined,
        apiUrl: undefined,
        apiHeaders: undefined,
        apiQueryParams: undefined,
        apiBodyTemplate: undefined,
        apiResponseJsonPath: undefined,
        apiCorsProxyUrl: undefined,
        apiDefaultCategory: undefined,
        scrapeNotes: searchMethod === "scrape" ? (scrapeNotes.trim() || undefined) : undefined,
      }),
    };
    onSave(source);
  };

  return (
    <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl space-y-3 font-sans">
      <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">
        {initialData?.id ? "Editar catálogo" : "Agregar nuevo catálogo"}
      </span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Nombre *</label>
          <input type="text" placeholder="Ej: Carrefour Argentina"
            value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-slate-600 font-semibold mb-1">Sitio Web</label>
          <input type="text" placeholder="https://www.carrefour.com.ar"
            value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-indigo-500 focus:outline-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-slate-600 font-semibold mb-1">Descripción</label>
          <input type="text" placeholder="Descripción corta"
            value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none" />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <h4 className="text-[10px] font-bold tracking-widest text-sky-600 uppercase mb-2">Búsqueda por enlace (click en escáner)</h4>
        <div className="grid grid-cols-1 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">URL de búsqueda {"{producto}"}</label>
            <input type="text"
              placeholder="Ej: https://www.carrefour.com.ar/catalogsearch/result/?q={producto}"
              value={searchUrlTemplate} onChange={(e) => setSearchUrlTemplate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-sky-500 focus:outline-none" />
          </div>
          {searchUrlTemplate && (
            <div className="flex items-center gap-3">
              <label className="text-slate-600 font-semibold">Mostrar enlace en escáner</label>
              <input type="checkbox" checked={siteSearchEnabled}
                onChange={(e) => setSiteSearchEnabled(e.target.checked)}
                className="w-4 h-4 accent-sky-600" />
            </div>
          )}
          {initialData?.id && (
            <div className="flex items-center gap-2">
              <button onClick={() => onInterpret(initialData)}
                disabled={interpretingId === initialData.id}
                className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-2.5 py-1.5 rounded-lg border border-sky-200 text-[10px] transition flex items-center gap-1 disabled:opacity-50">
                <Sparkles className="w-3 h-3" />
                {interpretingId === initialData.id ? "Interpretando..." : "Interpretar con IA"}
              </button>
              {aiInterpretation && (
                <div className="bg-indigo-50/50 p-2 rounded border border-indigo-100 text-[10px] text-slate-700 whitespace-pre-wrap font-serif flex-1">
                  {aiInterpretation}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <h4 className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase mb-2">Búsqueda programática (API / Scraping)</h4>
        <div className="text-xs space-y-3">
          <div className="flex items-center gap-4">
            <label className="text-slate-600 font-semibold">Método de búsqueda:</label>
            <select value={searchMethod}
              onChange={(e) => setSearchMethod(e.target.value as "api" | "scrape" | "none")}
              className="bg-white border border-slate-200 rounded-lg p-2 focus:border-emerald-500 focus:outline-none">
              <option value="none">Ninguno</option>
              <option value="api">API (JSON)</option>
              <option value="scrape">Scraping Web (HTML)</option>
            </select>
          </div>

          {searchMethod === "api" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Método HTTP</label>
                <select value={apiMethod}
                  onChange={(e) => setApiMethod(e.target.value as "GET" | "POST")}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:border-emerald-500 focus:outline-none">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Categoría por defecto</label>
                <select value={apiDefaultCategory}
                  onChange={(e) => setApiDefaultCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:border-emerald-500 focus:outline-none">
                  <option value="Fruits">Frutas y Verduras</option>
                  <option value="Meat">Carnicería</option>
                  <option value="Dairy">Lácteos</option>
                  <option value="Bakery">Panadería</option>
                  <option value="Pantry">Almacén</option>
                  <option value="Beverages">Bebidas</option>
                  <option value="Household">Limpieza y Hogar</option>
                  <option value="Other">Otros</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">URL de API {"{producto}"} *</label>
                <input type="text" placeholder="https://api.mercadolibre.com/sites/MLA/search?q={producto}"
                  value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">JSON Path</label>
                <input type="text" placeholder="Ej: results"
                  value={apiResponseJsonPath} onChange={(e) => setApiResponseJsonPath(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-mono focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">CORS Proxy URL</label>
                <input type="text" placeholder="https://corsproxy.io/?url={url}"
                  value={apiCorsProxyUrl} onChange={(e) => setApiCorsProxyUrl(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-mono focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Headers (JSON)</label>
                <input type="text" placeholder='{"Authorization":"Bearer token"}'
                  value={apiHeadersJson} onChange={(e) => setApiHeadersJson(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-mono focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Query Params (JSON)</label>
                <input type="text" placeholder='{"limit":"10"}'
                  value={apiQueryParamsJson} onChange={(e) => setApiQueryParamsJson(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-mono focus:border-emerald-500 focus:outline-none" />
              </div>
              {apiMethod === "POST" && (
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">Body Template (JSON con {"{producto}"})</label>
                  <input type="text" placeholder='{"search":"{producto}","limit":10}'
                    value={apiBodyTemplate} onChange={(e) => setApiBodyTemplate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-emerald-500 focus:outline-none" />
                </div>
              )}
            </div>
          )}

          {searchMethod === "scrape" && (
            <div className="grid grid-cols-1 gap-3 p-3 bg-sky-50/50 rounded-lg border border-sky-100">
              <p className="text-[10px] text-slate-500">
                Se usará la misma URL de búsqueda configurada arriba (campo "URL de búsqueda {"{producto}"}").
                El HTML se obtendrá, limpiará y enviará a Gemini para extraer los productos.
              </p>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Notas sobre el scraping</label>
                <input type="text" placeholder="Ej: requiere JavaScript, tiene rate limiting"
                  value={scrapeNotes} onChange={(e) => setScrapeNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] focus:border-sky-500 focus:outline-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LOCATION-SPECIFIC PRICING */}
      <div className="border-t border-slate-200 pt-3">
        <h4 className="text-[10px] font-bold tracking-widest text-amber-600 uppercase mb-2">Precios por ubicación</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Sales Channel (sc)</label>
            <input type="text" placeholder="Ej: 1, 32, 33, 34"
              value={salesChannel} onChange={(e) => setSalesChannel(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-amber-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Código Postal</label>
            <input type="text" placeholder="Ej: C1425AAA"
              value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-amber-500 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* SESSION / MEMBERSHIP LOGIN */}
      <div className="border-t border-slate-200 pt-3">
        <h4 className="text-[10px] font-bold tracking-widest text-rose-600 uppercase mb-2">Inicio de sesión / Membresía</h4>
        <div className="text-xs space-y-3">
          <div className="flex items-center gap-4">
            <label className="text-slate-600 font-semibold">Método:</label>
            <select value={sessionMethod}
              onChange={(e) => setSessionMethod(e.target.value as "none" | "form")}
              className="bg-white border border-slate-200 rounded-lg p-2 focus:border-rose-500 focus:outline-none">
              <option value="none">Ninguno</option>
              <option value="form">Formulario de login</option>
            </select>
          </div>
          {sessionMethod === "form" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-rose-50/50 rounded-lg border border-rose-100">
              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">URL de login</label>
                <input type="text" placeholder="https://comerciante.carrefour.com.ar/login"
                  value={sessionLoginUrl} onChange={(e) => setSessionLoginUrl(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-rose-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">Campos del formulario (JSON)</label>
                <input type="text" placeholder='{"numberId":"{dni}","name":"{name}","phone":"{phone}","email":"{email}"}'
                  value={sessionLoginFieldsJson} onChange={(e) => setSessionLoginFieldsJson(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-rose-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">reCAPTCHA Site Key</label>
                <input type="text" placeholder="6LdiZHIqAAAAA..."
                  value={sessionCaptchaSiteKey} onChange={(e) => setSessionCaptchaSiteKey(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] focus:border-rose-500 focus:outline-none" />
              </div>
              {initialData?.sessionId && (
                <div className="flex items-center">
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded">Sesión activa</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition shadow active:scale-95 flex items-center gap-1">
          <Save className="w-4 h-4" />
          {initialData?.id ? "Actualizar" : "Guardar"}
        </button>
        {initialData?.id && (
          <button onClick={() => onDelete(initialData.id!, initialData.name)}
            className="text-rose-500 hover:text-rose-600 font-bold bg-rose-50 hover:bg-rose-100 p-2 rounded-lg border border-rose-100 transition text-xs flex items-center gap-1">
            <Trash className="w-4 h-4" />
            Eliminar
          </button>
        )}
        <button onClick={onCancel}
          className="text-slate-500 hover:text-slate-700 font-semibold bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition text-xs">
          Cancelar
        </button>
      </div>
    </div>
  );
}
