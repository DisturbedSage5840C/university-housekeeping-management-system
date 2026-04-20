import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const WEBSITE_URLS = Platform.select({
  android: ['http://10.0.2.2', 'http://10.1.61.30'],
  ios: ['http://localhost', 'http://10.1.61.30'],
  default: ['http://localhost', 'http://10.1.61.30'],
});

const APP_WEB_VERSION = '2026-04-19-home-v1';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function getHost(url) {
  try {
    return new URL(url).host;
  } catch (_error) {
    return null;
  }
}

const WEBSITE_HOSTS = new Set(WEBSITE_URLS.map(getHost).filter(Boolean));

function isInAppUrl(url) {
  try {
    const parsed = new URL(url);
    return HTTP_PROTOCOLS.has(parsed.protocol) && WEBSITE_HOSTS.has(parsed.host);
  } catch (_error) {
    return false;
  }
}

const WINDOW_OPEN_BRIDGE = `
  (function () {
    var post = function (payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    };

    window.open = function (url) {
      post({ type: 'external', url: url });
      return null;
    };

    document.addEventListener('click', function (event) {
      var anchor = event.target.closest && event.target.closest('a[target="_blank"]');
      if (anchor && anchor.href) {
        event.preventDefault();
        post({ type: 'external', url: anchor.href });
      }
    }, true);
  })();
  true;
`;

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);

  const currentBaseUrl = WEBSITE_URLS[sourceIndex] || WEBSITE_URLS[0];
  const currentUrl = `${currentBaseUrl}/?v=${APP_WEB_VERSION}`;

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  const handleOpenExternal = useCallback(async (url) => {
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Unable to open external URL:', error);
    }
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.type === 'external') {
        handleOpenExternal(payload.url);
      }
    } catch (error) {
      console.warn('Invalid WebView message:', error);
    }
  }, [handleOpenExternal]);

  const handleShouldStartLoad = useCallback((request) => {
    const url = request.url || '';

    // Always allow sub-resources and internal browser mechanics.
    if (request.isTopFrame === false || url === 'about:blank') {
      return true;
    }

    if (isInAppUrl(url)) {
      return true;
    }

    // Let non-http(s) links (mailto:, tel:, intent:) open natively.
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      handleOpenExternal(url);
      return false;
    }

    handleOpenExternal(url);
    return false;
  }, [handleOpenExternal]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setReloadKey((current) => current + 1);
  }, []);

  const handleWebError = useCallback(() => {
    if (sourceIndex < WEBSITE_URLS.length - 1) {
      setSourceIndex((current) => current + 1);
      setReloadKey((current) => current + 1);
      return;
    }

    setHasError(true);
  }, [sourceIndex]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f7" />

      {hasError ? (
        <View style={styles.errorState}>
          <Text style={styles.errorIcon}>🧼</Text>
          <Text style={styles.errorTitle}>Housekeeping Tracker</Text>
          <Text style={styles.errorText}>
            Could not connect to the website at {currentUrl}.
          </Text>
          <Text style={styles.errorHint}>
            Make sure the website is running, then tap retry.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled={false}
          cacheMode="LOAD_NO_CACHE"
          geolocationEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          mixedContentMode="always"
          allowFileAccess
          pullToRefreshEnabled
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScriptBeforeContentLoaded={WINDOW_OPEN_BRIDGE}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onFileDownload={({ nativeEvent }) => {
            handleOpenExternal(nativeEvent.downloadUrl);
          }}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            if (hasError) {
              setHasError(false);
            }
          }}
          onError={handleWebError}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingIcon}>🧼</Text>
              <Text style={styles.loadingText}>Housekeeping Tracker</Text>
              <Text style={styles.loadingHint}>{currentUrl}</Text>
              <ActivityIndicator size="large" color="#00b8d4" style={styles.loadingSpinner} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  loadingIcon: {
    fontSize: 56,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  loadingHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
  },
  loadingSpinner: {
    marginTop: 18,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#f5f5f7',
  },
  errorIcon: {
    fontSize: 56,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  errorText: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#1f2937',
  },
  errorHint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: '#6b7280',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#00e5ff',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});
