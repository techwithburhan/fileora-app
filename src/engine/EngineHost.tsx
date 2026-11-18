/**
 * Keeps the offline tool engine running for the whole app: an invisible page loaded from the
 * app's own files (no website, no internet). It restarts by itself if the system stops it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { attach, detach, ENGINE_DIR, ENGINE_URL, receive, reset } from './engine';

const WV = WebView<object>;

export default function EngineHost() {
  const ref = useRef<WebView<object>>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    attach(js => ref.current?.injectJavaScript(js));
    return () => detach();
  }, []);

  const restart = useCallback((why: string) => {
    reset(why);
    setKey(k => k + 1);
  }, []);
  const onMessage = useCallback((e: WebViewMessageEvent) => receive(e.nativeEvent.data), []);

  return (
    <View style={styles.host} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <WV
        key={key}
        ref={ref}
        source={{ uri: ENGINE_URL }}
        originWhitelist={['file://*', 'about:*', 'blob:*', 'data:*']}
        allowFileAccess
        allowingReadAccessToURL={ENGINE_DIR}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false} // the celebration sound after a finished task
        domStorageEnabled={false}
        cacheEnabled={false}
        incognito
        onMessage={onMessage}
        // the page never navigates anywhere: no links, no website
        onShouldStartLoadWithRequest={r => /^file:\/\/.*\/engine\//.test(r.url) || /^(about|blob|data):/.test(r.url)}
        onContentProcessDidTerminate={() => restart('The tool engine was stopped by the system. Please run the tool again.')}
        onRenderProcessGone={() => {
          restart('The tool engine ran out of memory. Try fewer or smaller files.');
          return true;
        }}
        onError={() => restart('The tool engine couldn’t start. Please try again.')}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // a real (tiny) size: some systems pause pages that have no size at all
  host: { position: 'absolute', left: 0, bottom: 0, width: 2, height: 2, opacity: 0, overflow: 'hidden' },
  web: { width: 2, height: 2, backgroundColor: 'transparent' },
});
