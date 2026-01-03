const AGENT_API_BASE =
  (import.meta.env as any).VITE_AGENT_API_BASE?.trim() ||
  (import.meta.env as any).NEXT_PUBLIC_AGENT_API_BASE?.trim() ||
  '';

export const getAgentApiBase = (): string => {
  if (!AGENT_API_BASE) {
    throw new Error(
      "VITE_AGENT_API_BASE tanımlı değil. Agent API adresini .env dosyanıza ekleyin."
    );
  }
  return AGENT_API_BASE.replace(/\/$/, '');
};

export type CategoryOption = { id: string; label: string };

export const fetchCategoryOptions = async (): Promise<CategoryOption[]> => {
  const base = getAgentApiBase();
  const endpoint = `${base}/webchat/categories`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Kategori listesi alınamadı: ${response.status}`);
  }
  const data = (await response.json()) as { options?: CategoryOption[] };
  return Array.isArray(data.options) ? data.options : [];
};

export const fetchSupportedCategories = async (): Promise<string[]> => {
  const options = await fetchCategoryOptions();
  return options.map((o) => o.id).filter(Boolean);
};
