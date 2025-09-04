// Utilitaire pour créer un fetch sécurisé qui évite les interceptions de services tiers

// Utilitaire: créer un fetch natif frais via un iframe (évite les références périmées)
function createFreshNativeFetch(): typeof fetch {
  if (typeof window === "undefined" || !window.fetch) {
    return (globalThis.fetch || fetch).bind(globalThis as any);
  }
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    document.documentElement.appendChild(iframe);

    let iframeFetch: typeof fetch | null = null;
    if (iframe.contentWindow && iframe.contentWindow.fetch) {
      iframeFetch = iframe.contentWindow.fetch.bind(iframe.contentWindow);
    }

    // Nettoyage
    setTimeout(() => {
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch (e) {
        console.warn("Could not clean up iframe:", e);
      }
    }, 0);

    return (iframeFetch || window.fetch.bind(window)) as typeof fetch;
  } catch (error) {
    console.warn("createFreshNativeFetch failed, using window.fetch:", error);
    return window.fetch.bind(window);
  }
}

// Référence initiale (peut devenir invalide si le realm est détruit)
const originalFetch = createFreshNativeFetch();

// Interface pour les options étendues
interface SecureFetchOptions extends RequestInit {
  useNativeFetch?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

// Classe pour gérer les appels fetch sécurisés
export class SecureFetch {
  private static instance: SecureFetch;

  static getInstance(): SecureFetch {
    if (!SecureFetch.instance) {
      SecureFetch.instance = new SecureFetch();
    }
    return SecureFetch.instance;
  }

  // Détecter si fetch a été modifié par un service tiers
  private isNativeFetch(): boolean {
    if (typeof window === "undefined") return true;
    const fetchString = window.fetch.toString();
    const interceptorSignatures = [
      "fullstory",
      "fs.js",
      "sentry",
      "datadog",
      "bugsnag",
      "messageHandler",
    ];
    return !interceptorSignatures.some((s) =>
      fetchString.toLowerCase().includes(s.toLowerCase()),
    );
  }

  // Obtenir un fetch natif frais à la demande
  private getFreshNativeFetch(): typeof fetch {
    return createFreshNativeFetch();
  }

  // Créer un timeout pour les requêtes
  private createTimeoutSignal(timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }

  // Méthode principale de fetch sécurisé
  async fetch(
    url: string | URL,
    options: SecureFetchOptions = {},
  ): Promise<Response> {
    const {
      useNativeFetch = false,
      maxRetries = 2,
      retryDelay = 1000,
      timeout = 10000,
      ...fetchOptions
    } = options;

    let lastError: Error | null = null;
    // Flags
    let forceWindowFetch = false; // après realm shutdown
    let forceFreshNative = useNativeFetch; // si on veut éviter toute interception

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🌐 Secure fetch attempt ${attempt + 1}/${maxRetries + 1}: ${url}`,
        );

        // Choisir la fonction fetch à utiliser avec validation
        let fetchFunction: typeof fetch;

        let usedFreshNative = false;
        try {
          if (forceFreshNative && !forceWindowFetch) {
            // Utiliser un fetch natif fraîchement récupéré à chaque tentative
            fetchFunction = this.getFreshNativeFetch();
            usedFreshNative = true;
          } else if (!this.isNativeFetch() && !forceWindowFetch) {
            // Si window.fetch est intercepté, utiliser natif frais
            fetchFunction = this.getFreshNativeFetch();
            usedFreshNative = true;
          } else if (!forceWindowFetch) {
            // Sinon tenter la réf. initiale
            fetchFunction =
              typeof originalFetch === "function"
                ? (originalFetch as unknown as typeof fetch)
                : window.fetch.bind(window);
          } else {
            // Forcer window.fetch
            fetchFunction = window.fetch.bind(window);
          }
        } catch (scopeError) {
          console.warn(
            "Fetch function selection failed, using window.fetch:",
            scopeError,
          );
          fetchFunction = window.fetch.bind(window);
        }

        // Ajouter un timeout si pas déjà spécifié
        const requestOptions: any = { ...fetchOptions };
        // Toujours même-origine
        if (!requestOptions.credentials)
          requestOptions.credentials = "same-origin";
        // Éviter de passer un AbortSignal cross-realm au fetch d'iframe
        if (!requestOptions.signal && timeout > 0 && !usedFreshNative) {
          requestOptions.signal = this.createTimeoutSignal(timeout);
        } else if (usedFreshNative && requestOptions.signal) {
          try {
            delete requestOptions.signal;
          } catch {}
        }

        // Toujours utiliser une URL absolue pour éviter about:blank avec le fetch d'iframe
        let finalUrl: string | URL = url;
        if (typeof window !== "undefined") {
          if (typeof url === "string") {
            const hasProtocol = /^https?:\/\//i.test(url);
            if (!hasProtocol) {
              finalUrl = url.startsWith("/")
                ? `${window.location.origin}${url}`
                : new URL(url, window.location.href).toString();
            }
          } else if (url instanceof URL) {
            // OK
          }
        }

        const response = await fetchFunction(finalUrl as any, requestOptions);

        // Log du succès
        console.log(`✅ Secure fetch successful: ${url} (${response.status})`);
        return response;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message;

        console.warn(
          `⚠️ Secure fetch attempt ${attempt + 1} failed:`,
          errorMessage,
        );

        // Vérifier si c'est une erreur de portée globale
        const isGlobalScopeError = errorMessage.includes(
          "global scope is shutting down",
        );

        // Détecter une interception FullStory/Sentry via trace
        const looksIntercepted =
          errorMessage.toLowerCase().includes("messagehandler") ||
          errorMessage.toLowerCase().includes("fs.js") ||
          errorMessage.toLowerCase().includes("fullstory");

        // Vérifier si c'est une erreur réseau temporaire
        const isRetriableError =
          errorMessage.includes("Failed to fetch") ||
          errorMessage.includes("network") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("AbortError") ||
          isGlobalScopeError ||
          looksIntercepted;

        // Realm shutdown: forcer window.fetch
        if (isGlobalScopeError && attempt < maxRetries) {
          console.log(
            "🔄 Global scope error detected, forcing window.fetch for next attempt",
          );
          forceWindowFetch = true;
          continue; // retry immédiat
        }

        // Interception détectée: forcer un fetch natif frais
        if (looksIntercepted && attempt < maxRetries) {
          console.log(
            "🛡️ Interception detected, switching to fresh native fetch",
          );
          forceFreshNative = true;
          forceWindowFetch = false;
          continue; // retry immédiat
        }

        // Ne pas retry sur la dernière tentative ou si l'erreur n'est pas retriable
        if (attempt === maxRetries || !isRetriableError) {
          break;
        }

        // Délai avant le retry (délai exponentiel)
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Si toutes les tentatives ont échoué
    console.error(`❌ All secure fetch attempts failed for: ${url}`);

    // Améliorer le message d'erreur
    if (lastError) {
      const enhancedError = new Error(
        `Network request failed after ${maxRetries + 1} attempts: ${lastError.message}`,
      );
      enhancedError.name = "SecureFetchError";
      enhancedError.stack = lastError.stack;
      throw enhancedError;
    }

    throw new Error("Network request failed: Unknown error");
  }

  // Méthodes utilitaires pour les types de requêtes courants
  async get(
    url: string | URL,
    options: SecureFetchOptions = {},
  ): Promise<Response> {
    return this.fetch(url, { ...options, method: "GET" });
  }

  async post(
    url: string | URL,
    data?: any,
    options: SecureFetchOptions = {},
  ): Promise<Response> {
    const postOptions: SecureFetchOptions = {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    if (data !== undefined) {
      postOptions.body = typeof data === "string" ? data : JSON.stringify(data);
    }

    return this.fetch(url, postOptions);
  }

  async put(
    url: string | URL,
    data?: any,
    options: SecureFetchOptions = {},
  ): Promise<Response> {
    const putOptions: SecureFetchOptions = {
      ...options,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    if (data !== undefined) {
      putOptions.body = typeof data === "string" ? data : JSON.stringify(data);
    }

    return this.fetch(url, putOptions);
  }

  async delete(
    url: string | URL,
    options: SecureFetchOptions = {},
  ): Promise<Response> {
    return this.fetch(url, { ...options, method: "DELETE" });
  }

  // Diagnostic pour vérifier l'état du fetch
  diagnose(): {
    isNativeFetch: boolean;
    fetchSource: string;
    recommendations: string[];
  } {
    const isNative = this.isNativeFetch();
    const fetchString =
      typeof window !== "undefined"
        ? window.fetch.toString()
        : "N/A (server-side)";

    const recommendations: string[] = [];

    if (!isNative) {
      recommendations.push(
        "Fetch has been intercepted by a third-party service",
      );
      recommendations.push(
        "Consider using useNativeFetch: true for critical requests",
      );
      recommendations.push(
        "Check for services like FullStory, Sentry, or DataDog",
      );
    }

    return {
      isNativeFetch: isNative,
      fetchSource:
        fetchString.substring(0, 200) + (fetchString.length > 200 ? "..." : ""),
      recommendations,
    };
  }
}

// Instance singleton pour l'exportation
export const secureFetch = SecureFetch.getInstance();

// Export par défaut pour une utilisation simple
export default secureFetch;

// Fonction utilitaire pour remplacer window.fetch dans les cas critiques
export function createFetchPolyfill(): typeof fetch {
  return secureFetch.fetch.bind(secureFetch) as unknown as typeof fetch;
}

// Hook pour diagnostiquer les problèmes de fetch
export function useFetchDiagnostics() {
  return secureFetch.diagnose();
}
