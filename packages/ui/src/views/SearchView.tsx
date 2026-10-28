import { type FormEvent, type RefObject } from "react";
import { type Config, type Service } from "@tuxtelly/core";
import { navigateSearch } from "../search-navigation";

export type SearchResult = {
  tmdbId: number;
  mediaType: string;
  title: string;
  year: string | null;
  overview: string;
  posterUrl: string | null;
  matchedServices: Array<{ serviceId: string; availability: string }>;
};

export type SearchViewProps = {
  config: Config;
  tmdbConfigured: boolean;
  searchRegion: string;
  searchServices: string[];
  includePaidOffers: boolean;
  onSearchServicesChange: (serviceIds: string[]) => void;
  onIncludePaidOffersChange: (includePaidOffers: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: SearchResult[];
  onSearch: (event?: FormEvent) => Promise<void>;
  searchStatus: string;
  searchBusy: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  launchService: (service: Service) => Promise<void>;
};

function offerLabel(availability: string) {
  return (
    {
      flatrate: "Subscription",
      free: "Free",
      ads: "With ads",
      rent: "Rent",
      buy: "Buy",
    }[availability] ?? availability
  );
}

export function SearchView({
  config,
  tmdbConfigured,
  searchRegion,
  searchServices,
  includePaidOffers,
  onSearchServicesChange,
  onIncludePaidOffersChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSearch,
  searchStatus,
  searchBusy,
  searchInputRef,
  launchService,
}: SearchViewProps) {
  return (
    <main
      className="settings search-page"
      onKeyDown={(event) => {
        if (navigateSearch(event.currentTarget, event.nativeEvent))
          event.stopPropagation();
      }}
    >
      <p className="eyebrow">FIND SOMETHING TO WATCH</p>
      <h1>
        Search <span>everywhere.</span>
      </h1>
      <p className="subtitle">
        Search titles and see which selected services list them in{" "}
        {searchRegion}. Listings do not confirm access through your
        subscription.
      </p>
      <form
        className="global-search"
        onSubmit={(event) => void onSearch(event)}
      >
        <input
          ref={searchInputRef}
          type="search"
          aria-label="Search movies and shows"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Movie or show title"
        />
        <button className="primary" disabled={searchBusy || !tmdbConfigured}>
          Search
        </button>
      </form>
      <p className="hint search-keyboard-hint">
        Use ↑ ↓ to move through filters and results · Enter to open · ← → move
        the query cursor
      </p>
      {!tmdbConfigured && (
        <p className="hint">Add a TMDB API key in Settings to enable search.</p>
      )}
      <div className="search-filters">
        <span>Included services</span>
        {config.services
          .filter((service) => service.enabled)
          .map((service) => (
            <label className="search-service" key={service.id}>
              <input
                type="checkbox"
                checked={searchServices.includes(service.id)}
                onChange={(event) =>
                  event.target.checked
                    ? onSearchServicesChange([...searchServices, service.id])
                    : onSearchServicesChange(
                        searchServices.filter((id) => id !== service.id),
                      )
                }
              />
              {service.name}
            </label>
          ))}
      </div>
      <label className="search-paid-filter">
        <input
          type="checkbox"
          checked={includePaidOffers}
          onChange={(event) => onIncludePaidOffersChange(event.target.checked)}
        />
        Also show rent and buy offers
      </label>
      {searchStatus && (
        <p className="search-status" role="status">
          {searchStatus}
        </p>
      )}
      <div className="search-results">
        {searchResults.map((result) => (
          <article
            className="result-card"
            key={`${result.mediaType}-${result.tmdbId}`}
          >
            {result.posterUrl ? (
              <img src={result.posterUrl} alt="" loading="lazy" />
            ) : (
              <div className="poster-placeholder">TUXTELLY</div>
            )}
            <div className="result-copy">
              <span className="eyebrow">
                {result.mediaType === "tv" ? "SERIES" : "MOVIE"}
                {result.year ? ` · ${result.year}` : ""}
              </span>
              <h2>{result.title}</h2>
              <p>{result.overview || "No description available."}</p>
              <div className="result-services">
                {result.matchedServices.map((match) => {
                  const service = config.services.find(
                    (entry) => entry.id === match.serviceId,
                  );
                  return service ? (
                    <button
                      key={`${match.serviceId}-${match.availability}`}
                      onClick={() => void launchService(service)}
                    >
                      Open {service.name} · {offerLabel(match.availability)}
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
      {searchResults.length > 0 && (
        <p className="attribution">
          Movie and TV data provided by TMDB. Streaming availability powered by
          JustWatch.
        </p>
      )}
      {searchResults.length === 0 && !searchStatus && searchQuery && (
        <p className="hint">
          No matching titles found for the included services.
        </p>
      )}
    </main>
  );
}
