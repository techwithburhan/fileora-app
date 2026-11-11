import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import WebPage from '../components/WebPage';
import { PAGES } from '../config';
import { Theme } from '../theme';

/** The website's ATS Resume Builder (everything stays on the phone; the PDF is saved to Downloads/Fileora). */
export default function ResumeScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} />
      <WebPage url={PAGES.resume} theme={theme} onBackAtStart={() => nav.navigate('Tabs', { screen: 'Home' })} />
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
