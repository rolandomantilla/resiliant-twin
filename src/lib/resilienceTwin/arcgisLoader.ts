// Loads the ArcGIS Maps SDK for JavaScript from Esri's CDN (classic AMD build)
// so the map works without an npm package or an ArcGIS API key. Public,
// key-less Esri world basemap map services are used as TileLayer sources.
const ARCGIS_VERSION = "4.31";
const SCRIPT_URL = `https://js.arcgis.com/${ARCGIS_VERSION}/init.js`;
const CSS_URL = `https://js.arcgis.com/${ARCGIS_VERSION}/esri/themes/light/main.css`;

declare global {
  interface Window {
    require?: (modules: string[], callback: (...mods: any[]) => void) => void;
    __resilienceTwinArcgisPromise?: Promise<void>;
  }
}

export function loadArcgis(): Promise<void> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("ArcGIS requires a browser environment"));
  if (window.__resilienceTwinArcgisPromise)
    return window.__resilienceTwinArcgisPromise;

  window.__resilienceTwinArcgisPromise = new Promise<void>(
    (resolve, reject) => {
      if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = CSS_URL;
        document.head.appendChild(link);
      }
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${SCRIPT_URL}"]`,
      );
      if (existing && typeof window.require !== "undefined") {
        resolve();
        return;
      }
      const script = existing ?? document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error("Could not load the ArcGIS Maps SDK from js.arcgis.com"),
        );
      if (!existing) document.body.appendChild(script);
    },
  );
  return window.__resilienceTwinArcgisPromise;
}

export function arcgisRequire<T extends any[]>(modules: string[]): Promise<T> {
  return loadArcgis().then(
    () =>
      new Promise<T>((resolve, reject) => {
        if (!window.require) {
          reject(new Error("ArcGIS AMD loader unavailable"));
          return;
        }
        try {
          window.require(modules, (...mods: T) => resolve(mods));
        } catch (err) {
          reject(err as Error);
        }
      }),
  );
}

/** Public, key-less Esri world basemap map services (classic REST tile layers). */
export const BASEMAP_SERVICE_URLS: Record<string, string> = {
  streets:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
  satellite:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
  topographic:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer",
  gray: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer",
};
