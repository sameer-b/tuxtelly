export type ProviderDirectoryEntry = {
  provider_id: number;
  provider_name: string;
};

export type ServiceProviderIdentity = {
  id: string;
  adapter: string;
  name: string;
  url: string;
};

export type OfferType = "flatrate" | "free" | "ads" | "rent" | "buy";
export type ProviderOffers = Partial<
  Record<OfferType, ProviderDirectoryEntry[]>
>;

const providerAliases: Record<string, string[]> = {
  netflix: ["netflix", "netflix kids", "netflix standard with ads"],
  disney: [
    "disney plus",
    "disney+",
    "disney plus basic",
    "disney plus standard",
    "disney plus premium",
    "disney plus with ads",
    "disney plus basic with ads",
    "disney plus standard with ads",
    "disney plus (no ads)",
    "disney plus hotstar",
    "disney+ hotstar",
  ],
  hbo: ["max", "hbo max", "hbomax"],
  prime: ["amazon prime video", "prime video", "amazon video"],
  youtube: ["youtube", "youtube premium", "youtube movies"],
  hulu: [
    "hulu",
    "hulu with ads",
    "hulu basic with ads",
    "hulu no ads",
    "hulu ad free",
    "hulu premium",
  ],
  peacock: [
    "peacock",
    "peacock tv",
    "peacock premium",
    "peacock premium plus",
  ],
};

/**
 * Canonicalize common brand typography before exact matching. In particular,
 * `Disney+`, `Disney +`, and `Disney Plus` all become `disney plus`.
 * Exact matching is intentional: `YouTube TV` must not match `YouTube`.
 */
export function normalizeProviderName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesFor(service: ServiceProviderIdentity) {
  const known = providerAliases[service.id] ?? providerAliases[service.adapter];
  if (known) return known;

  const identity = normalizeProviderName(
    `${service.id} ${service.name} ${new URL(service.url).hostname}`,
  );
  if (identity.includes("hulu")) return providerAliases.hulu;
  if (identity.includes("disney")) return providerAliases.disney;
  if (identity.includes("peacock")) return providerAliases.peacock;
  return [service.name];
}

/** Resolve configured services to IDs from TMDB's current regional directory. */
export function resolveProviderIds(
  services: ServiceProviderIdentity[],
  providers: ProviderDirectoryEntry[],
) {
  const result = new Map<string, number[]>();
  for (const service of services) {
    const aliases = new Set(aliasesFor(service).map(normalizeProviderName));
    const ids = providers
      .filter((provider) =>
        aliases.has(normalizeProviderName(provider.provider_name)),
      )
      .map((provider) => provider.provider_id);
    if (ids.length) result.set(service.id, [...new Set(ids)]);
  }
  return result;
}

/** Match a title's actual offer records to configured services. */
export function matchServiceOffers(
  services: ServiceProviderIdentity[],
  offers: ProviderOffers,
  categories: readonly OfferType[],
) {
  const providers = [
    ...new Map(
      categories
        .flatMap((category) => offers[category] ?? [])
        .map((provider) => [provider.provider_id, provider] as const),
    ).values(),
  ];
  const ids = resolveProviderIds(services, providers);
  return services.flatMap((service) => {
    const serviceIds = new Set(ids.get(service.id) ?? []);
    return categories
      .filter((category) =>
        offers[category]?.some((offer) => serviceIds.has(offer.provider_id)),
      )
      .map((availability) => ({ serviceId: service.id, availability }));
  });
}
