# Global search setup

TuxTelly can search TMDB movie and TV metadata and show which included services list a title in your selected region. It uses the Firefox extension directly; there is no TuxTelly server or PVE container in this version.

## Configure TMDB

1. Open TuxTelly in Firefox and go to **Settings → Global search**.
2. Paste your TMDB API key. Use **Test key** to verify it, then save it.
3. Allow the requested TMDB connection permission when Firefox asks.
4. Select the services to include and set a two-letter country code, such as `US`.
5. Open **Search**, enter at least two characters, and submit.

The key is stored in Firefox extension-local storage, separate from TuxTelly's exported configuration. It is not returned in extension state, included in diagnostics, or sent to the hosted launcher. The extension background attaches it to requests to TMDB. A person with access to the Firefox profile or extension can still inspect it, so this arrangement is intended for personal/self-hosted use rather than embedding a shared key in a public build. Remove or replace it from Settings.

Search results use TMDB metadata and TMDB's JustWatch-powered regional provider data. By default, results include subscription, free, and ad-supported availability (“stream now”); rental and purchase-only listings are hidden. Turn on **Also show rent and buy offers** on the Search page to include those paid listings. Hulu and Peacock are built-in services; existing profiles add them through one-time upgrades and include them in the default search filters. Results describe provider listings in the selected region and cannot verify your account, subscription tier, profile restrictions, or current entitlement. Selecting a service opens its TuxTelly tab; provider-specific direct links are not guaranteed. Results display TMDB and JustWatch attribution.

Provider names are resolved against the providers TMDB returns for each individual title, avoiding dependence on a separate or incomplete regional provider directory. Matching normalizes punctuation and common brand typography (for example, `Disney+`, `Disney +`, and `Disney Plus`) while requiring an exact canonical name, so similarly named services such as YouTube TV do not get folded into YouTube. Peacock Premium and Peacock Premium Plus are recognized as Peacock offers, while Amazon Channel bundles are kept separate. Existing saved service filters receive newly supported built-ins once without replacing a user's other selections. Regression tests cover title offers, Disney spelling variants, Peacock subscription tiers, and similarly named provider boundaries. TMDB provider data may still omit a service in a particular region. YouTube public-video search is not included in this movie/TV availability search. An empty result can mean no matching listing or missing regional provider data. Provider pages remain the source of truth for playback.

## Privacy and network behavior

- The API key and service filters are stored in the Firefox profile, not in exported app configuration.
- Search text is sent directly from the extension background to TMDB and is not saved by TuxTelly.
- Requests are limited to TMDB's API host; poster images load from TMDB's image host after permission is granted.
- TuxTelly does not access provider cookies or login credentials.
- Search continues to be optional. Home, service tabs, and playback work when TMDB is unavailable.
