import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import WebPage from '../components/WebPage';
import { pageLink } from '../api/wp';
import { RootStackParamList } from '../navigation/types';
import { brand, Theme } from '../theme';

export default function WebScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Web'>>();
  const [url, setUrl] = useState<string | null>(params.url ?? null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (params.url || !params.slugs) return;
    pageLink(params.slugs)
      .then(u => (u ? setUrl(u) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [params.url, params.slugs]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader
        title={params.title}
        theme={theme}
        onBack={() => nav.goBack()}
        action={url ? { icon: 'external', label: 'Open in browser', onPress: () => Linking.openURL(url) } : undefined}
      />
      {url ? (
        <WebPage url={url} theme={theme} tool={params.tool} />
      ) : (
        <View style={styles.center}>
          {missing ? (
            <Text style={[styles.text, { color: theme.muted }]}>This page couldn’t be found. Check your connection, or the page may not exist on the website yet.</Text>
          ) : (
            <ActivityIndicator color={brand.green} size="large" />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
