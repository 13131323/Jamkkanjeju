import * as Network from 'expo-network';
import { useCallback, useEffect, useState } from 'react';

export type NetworkStatus = 'checking' | 'online' | 'offline';

function getNetworkStatus(state: Network.NetworkState): NetworkStatus {
  if (state.isConnected === false || state.isInternetReachable === false) {
    return 'offline';
  }

  if (state.isConnected === true) {
    return 'online';
  }

  return 'checking';
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>('checking');

  const refresh = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setStatus(getNetworkStatus(state));
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    // refresh updates state only after the native network-state Promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    const subscription = Network.addNetworkStateListener((state) => {
      setStatus(getNetworkStatus(state));
    });

    return () => subscription.remove();
  }, [refresh]);

  return { status, refresh };
}
