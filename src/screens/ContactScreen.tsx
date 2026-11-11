/** Native contact form → the website's own endpoint (messages arrive in Fileora → Messages). */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { CONTACT_TOPICS, sendContact } from '../api/wp';
import { Theme } from '../theme';

type Errors = Partial<Record<'name' | 'email' | 'message', string>>;
const MAX = 5000; // same limit as the website form

export default function ContactScreen({ theme }: { theme: Theme }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('general');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [note, setNote] = useState('');
  const started = useRef(Date.now());

  useEffect(() => {
    started.current = Date.now();
  }, []);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!name.trim()) e.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Please enter a valid email address, for example name@example.com.';
    if (message.trim().length < 10) e.message = 'Please write a little more (at least 10 characters).';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    setNote('');
    if (Object.keys(e).length) return;
    setStatus('sending');
    try {
      const r = await sendContact({ name: name.trim(), email: email.trim(), topic, message: message.trim(), elapsedMs: Date.now() - started.current });
      if (r.ok) {
        setStatus('sent');
        setNote(r.message ?? 'Thank you! We’ll reply by email.');
      } else {
        setStatus('idle');
        setErrors((r.errors as Errors) ?? {});
        setNote(r.message ?? 'Please check the highlighted fields.');
      }
    } catch {
      setStatus('idle');
      setNote('No connection. Please check your internet and try again.');
    }
  };

  const field = (label: string, err: string | undefined, input: React.ReactNode) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.ink }]}>{label}</Text>
      {input}
      {err ? (
        <Animated.Text entering={FadeIn} style={[styles.err, { color: theme.danger }]}>
          {err}
        </Animated.Text>
      ) : null}
    </View>
  );
  const inputStyle = (err?: string) => [styles.input, { color: theme.ink, backgroundColor: theme.surface, borderColor: err ? theme.danger : theme.line }];

  if (status === 'sent') {
    return (
      <View style={[styles.flex, { backgroundColor: theme.bg }]}>
        <AppHeader theme={theme} />
        <View style={styles.done}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.doneIcon, { backgroundColor: theme.accent }]}>
            <Icon name="check" size={40} color="#fff" width={3} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(150)} style={[styles.doneTitle, { color: theme.ink }]}>
            Message sent
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(250)} style={[styles.doneText, { color: theme.muted }]}>
            {note}
          </Animated.Text>
          <PressableScale
            onPress={() => {
              setMessage('');
              setStatus('idle');
              setNote('');
              started.current = Date.now();
            }}
            accessibilityRole="button"
            style={[styles.send, { backgroundColor: theme.surface2 }]}>
            <Text style={[styles.sendText, { color: theme.ink }]}>Send another message</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.ink }]}>Contact us</Text>
          <Text style={[styles.lead, { color: theme.ink2 }]}>A question, a tool that isn’t working, or an idea? Write to us and we’ll answer by email.</Text>
          {field(
            'Your name',
            errors.name,
            <TextInput value={name} onChangeText={setName} style={inputStyle(errors.name)} autoComplete="name" textContentType="name" accessibilityLabel="Your name" />,
          )}
          {field(
            'Email address',
            errors.email,
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={inputStyle(errors.email)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel="Email address"
            />,
          )}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.ink }]}>Topic</Text>
            <View style={styles.topics}>
              {CONTACT_TOPICS.map(t => {
                const on = t.id === topic;
                return (
                  <PressableScale
                    key={t.id}
                    onPress={() => setTopic(t.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[styles.topic, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? theme.accent : theme.line }]}>
                    <Text style={[styles.topicText, { color: on ? theme.onAccent : theme.ink2 }]}>{t.label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
          {field(
            'Message',
            errors.message,
            <TextInput
              value={message}
              onChangeText={t => setMessage(t.slice(0, MAX))}
              style={[inputStyle(errors.message), styles.area]}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Message"
            />,
          )}
          <Text style={[styles.counter, { color: theme.muted }]}>
            {message.length} / {MAX}
          </Text>
          {note ? <Text style={[styles.note, { color: theme.danger }]}>{note}</Text> : null}
          <PressableScale
            onPress={submit}
            disabled={status === 'sending'}
            accessibilityRole="button"
            accessibilityState={{ busy: status === 'sending' }}
            style={[styles.send, { backgroundColor: theme.accent }]}>
            {status === 'sending' ? <ActivityIndicator color={theme.onAccent} /> : <Text style={[styles.sendText, { color: theme.onAccent }]}>Send message</Text>}
          </PressableScale>
          <Text style={[styles.small, { color: theme.muted }]}>We use your name and email only to answer you (see the Privacy policy in the menu).</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800' },
  lead: { fontSize: 15, lineHeight: 22 },
  field: { gap: 6 },
  label: { fontSize: 14.5, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
  area: { minHeight: 150, paddingTop: 12 },
  err: { fontSize: 13.5, fontWeight: '600' },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topic: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, minHeight: 38, justifyContent: 'center' },
  topicText: { fontSize: 13.5, fontWeight: '700' },
  counter: { fontSize: 12.5, textAlign: 'right', marginTop: -8 },
  note: { fontSize: 14, fontWeight: '600' },
  send: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 16.5, fontWeight: '800' },
  small: { fontSize: 12.5, lineHeight: 18 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  doneIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 22, fontWeight: '800' },
  doneText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
