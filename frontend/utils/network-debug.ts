// Utilitaire pour diagnostiquer les problèmes de connectivité réseau
import React from "react";

interface NetworkStatus {
  isOnline: boolean;
  backendReachable: boolean;
  latency?: number;
  lastCheck: string;
  error?: string;
}

class NetworkDiagnostics {
  private static instance: NetworkDiagnostics;
  private status: NetworkStatus = {
    isOnline: navigator.onLine,
    backendReachable: false,
    lastCheck: new Date().toISOString(),
  };

  private listeners: Array<(status: NetworkStatus) => void> = [];

  constructor() {
    this.setupNetworkListeners();
  }

  static getInstance(): NetworkDiagnostics {
    if (!NetworkDiagnostics.instance) {
      NetworkDiagnostics.instance = new NetworkDiagnostics();
    }
    return NetworkDiagnostics.instance;
  }

  private setupNetworkListeners() {
    // Écouter les changements de statut réseau
    window.addEventListener("online", () => {
      console.log("🌐 Network: Back online");
      this.updateStatus({ isOnline: true });
      this.checkBackendConnectivity();
    });

    window.addEventListener("offline", () => {
      console.log("🌐 Network: Went offline");
      this.updateStatus({ isOnline: false, backendReachable: false });
    });

    // Vérification initiale
    this.checkBackendConnectivity();
  }

  private updateStatus(updates: Partial<NetworkStatus>) {
    this.status = {
      ...this.status,
      ...updates,
      lastCheck: new Date().toISOString(),
    };

    // Notifier tous les listeners
    this.listeners.forEach((listener) => listener(this.status));
  }

  async checkBackendConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      this.updateStatus({
        isOnline: false,
        backendReachable: false,
        error: "No internet connection",
      });
      return false;
    }

    try {
      const startTime = Date.now();

      // Test de ping vers le backend
      const response = await fetch("/api/health", {
        method: "GET",
        signal: AbortSignal.timeout(5000), // 5 secondes timeout
        cache: "no-cache",
      });

      const latency = Date.now() - startTime;
      const isReachable = response.ok;

      this.updateStatus({
        isOnline: true,
        backendReachable: isReachable,
        latency,
        error: isReachable ? undefined : `HTTP ${response.status}`,
      });

      if (isReachable) {
        console.log(`✅ Backend reachable (${latency}ms)`);
      } else {
        console.warn(`⚠️ Backend returned ${response.status}`);
      }

      return isReachable;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.updateStatus({
        isOnline: navigator.onLine,
        backendReachable: false,
        error: errorMessage,
      });

      console.error("❌ Backend connectivity check failed:", errorMessage);
      return false;
    }
  }

  // Abonnement aux changements de statut
  subscribe(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.push(listener);

    // Envoyer immédiatement le statut actuel
    listener(this.status);

    // Retourner la fonction de désabonnement
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  // Test complet avec détails
  async runDiagnostics(): Promise<{
    network: NetworkStatus;
    recommendations: string[];
  }> {
    await this.checkBackendConnectivity();

    const recommendations: string[] = [];

    if (!this.status.isOnline) {
      recommendations.push("Vérifiez votre connexion internet");
    } else if (!this.status.backendReachable) {
      recommendations.push("Le serveur semble inaccessible");
      recommendations.push("Essayez de rafraîchir la page");
      recommendations.push(
        "Vérifiez si le serveur de développement fonctionne",
      );
    } else if (this.status.latency && this.status.latency > 2000) {
      recommendations.push("Connexion lente détectée");
      recommendations.push("Vérifiez votre connexion internet");
    }

    return {
      network: this.getStatus(),
      recommendations,
    };
  }

  // Test automatique périodique
  startPeriodicCheck(intervalMs: number = 30000) {
    setInterval(() => {
      if (navigator.onLine) {
        this.checkBackendConnectivity();
      }
    }, intervalMs);
  }
}

// Instance singleton
export const networkDiagnostics = NetworkDiagnostics.getInstance();

// Hook React pour utiliser le diagnostic réseau
export function useNetworkStatus() {
  const [status, setStatus] = React.useState<NetworkStatus>(() => {
    try {
      return networkDiagnostics.getStatus();
    } catch (error) {
      console.warn("Failed to get initial network status:", error);
      return {
        isOnline: navigator.onLine,
        backendReachable: false,
        lastCheck: new Date().toISOString(),
      };
    }
  });

  React.useEffect(() => {
    try {
      const unsubscribe = networkDiagnostics.subscribe(setStatus);
      return unsubscribe;
    } catch (error) {
      console.warn("Failed to subscribe to network status:", error);
      return () => {}; // Retourner une fonction vide de cleanup
    }
  }, []);

  return {
    status,
    checkConnectivity: () => {
      try {
        return networkDiagnostics.checkBackendConnectivity();
      } catch (error) {
        console.warn("Failed to check connectivity:", error);
        return Promise.resolve(false);
      }
    },
    runDiagnostics: () => {
      try {
        return networkDiagnostics.runDiagnostics();
      } catch (error) {
        console.warn("Failed to run diagnostics:", error);
        return Promise.resolve({
          network: status,
          recommendations: ["Erreur lors du diagnostic réseau"],
        });
      }
    },
  };
}

// Pour les cas où React n'est pas disponible
if (typeof window !== "undefined") {
  // Exposer globalement pour le débogage
  (window as any).networkDiagnostics = networkDiagnostics;
}
