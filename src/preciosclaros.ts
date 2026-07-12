export interface PreciosClarosProduct {
  nombre: string;
  precio: number;
  presentacion: string;
  supermercado: string;
  sucursal: string;
  direccion: string;
  localidad: string;
  provincia: string;
  fecha_actualizacion: string;
  categoria: string;
}

export async function searchPreciosClaros(query: string, maxResults = 50): Promise<PreciosClarosProduct[]> {
  try {
    const res = await fetch(
      `https://preciosclaros.gob.ar/webservice/precios/producto/buscar?busqueda=${encodeURIComponent(query)}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, maxResults);
  } catch {
    return [];
  }
}
