/**
 * Promotions (App Center → Promotions): offers, news and links as cards with an image, a title,
 * a text and a button. Managed in WordPress; changes arrive with the next settings refresh.
 */
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { openLink } from '../lib/links';
import { remote, useRemote } from '../remote/remote';
import { Theme } from '../theme';
import { type } from '../typography';
import Appear from '../components/Appear';
import PullRefresh from '../components/PullRefresh';
import Animated from 'react-native-reanimated';

export default function PromoScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const promo = useRemote(s => s.config?.promo ?? null);
  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader
        title={promo?.title || 'Promotions'}
        theme={theme}
        onBack={() => nav.goBack()}
      />
      <PullRefresh theme={theme} onRefresh={() => remote.refresh(true)}>
        <Animated.ScrollView
        contentContainerStyle={styles.content}
      >
        {promo?.intro ? (
          <Text style={[type.body, { color: theme.ink2 }]}>{promo.intro}</Text>
        ) : null}
        {promo?.items.map((it, i) => (
          <Appear
            key={it.id} delay={Math.min(i, 6) * 60} duration={380}
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.line },
            ]}
          >
            {it.image ? (
              <Image
                source={{ uri: it.image }}
                style={[styles.image, { backgroundColor: theme.surface2 }]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <View style={styles.body}>
              <Text
                style={[type.section, { color: theme.ink }]}
                accessibilityRole="header"
              >
                {it.title}
              </Text>
              {it.text ? (
                <Text style={[type.body, { color: theme.ink2 }]}>
                  {it.text}
                </Text>
              ) : null}
              {it.link ? (
                <PressableScale
                  onPress={() => openLink(it.link, it.title)}
                  accessibilityRole="link"
                  style={[styles.btn, { backgroundColor: theme.accent }]}
                >
                  <Text style={[type.button, { color: theme.onAccent }]}>
                    {it.button || 'Open'}
                  </Text>
                  <Icon
                    name="chevron"
                    size={18}
                    color={theme.onAccent}
                    width={2.4}
                  />
                </PressableScale>
              ) : null}
            </View>
          </Appear>
        ))}
        {!promo && (
          <View style={styles.empty}>
            <View
              style={[styles.emptyIcon, { backgroundColor: theme.surface2 }]}
            >
              <Icon name="party" size={30} color={theme.muted} />
            </View>
            <Text style={[type.heading, { color: theme.ink }]}>
              No promotions right now
            </Text>
            <Text style={[type.bodySm, styles.center, { color: theme.muted }]}>
              Check back later for offers and news.
            </Text>
          </View>
        )}
        </Animated.ScrollView>
      </PullRefresh>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 16 / 9 },
  body: { padding: 16, gap: 8 },
  btn: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
});
