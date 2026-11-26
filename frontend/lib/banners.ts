export type BannerPublico = {
  id: number;
  titulo: string;
  imagen: string;
};

export async function fetchBanners(signal?: AbortSignal): Promise<BannerPublico[]> {
  try {
    const res = await fetch("/api/catalogo/banners", {
      signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) {
      return [];
    }
    return (payload.data?.banners ?? []).filter(
      (banner: BannerPublico) => banner?.imagen,
    );
  } catch {
    return [];
  }
}
