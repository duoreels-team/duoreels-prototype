/**
 * Chat with an editor (prototype V.thread): bubbles, send, the demo editor answers.
 */
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font } from '@/constants/brand';
import { person } from '@/lib/people';
import { editorFull, type Message } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { useOverlay } from '@/providers/overlay-provider';

const AUTO_REPLY = 'Sounds good! Send me the brief and I can start Friday.';
// Leo, Sara, Jon… aren't real people yet, so they answer with the prototype's demo reply.
const DEMO_EDITORS = ['L', 'S', 'J', 'F', 'K', 'D'];

export default function ThreadScreen() {
  const { k = 'L' } = useLocalSearchParams<{ k: string }>();
  const insets = useSafeAreaInsets();
  const { toast } = useOverlay();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    supabase
      .from('messages')
      .select('id, editor_key, from_me, body, created_at')
      .eq('editor_key', k)
      .order('created_at')
      .then(({ data }) => setMsgs((data as Message[]) ?? []));
  }, [k]);

  async function send() {
    const v = text.trim();
    if (!v) return;
    setText('');
    const { data, error } = await supabase.from('messages').insert({ editor_key: k, from_me: true, body: v }).select('id, editor_key, from_me, body, created_at').single();
    if (error || !data) {
      setText(v);
      toast("Couldn't send · check your connection");
      return;
    }
    setMsgs((m) => [...m, data as Message]);
    if (!DEMO_EDITORS.includes(k)) return;
    setTimeout(async () => {
      const r = await supabase.from('messages').insert({ editor_key: k, from_me: false, body: AUTO_REPLY }).select('id, editor_key, from_me, body, created_at').single();
      if (r.data) setMsgs((m) => [...m, r.data as Message]);
    }, 1400);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title={editorFull(k)} sub="Usually replies in 1–2 h" subAvatar={k} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.chat} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {msgs.map((m) => (
            <View key={m.id} style={{ gap: 2 }}>
              <Animated.View entering={ZoomIn.duration(350)} style={[styles.bubble, m.from_me ? styles.me : styles.them]}>
                <Text style={[styles.bubbleText, m.from_me && { color: Color.black }]}>{m.body}</Text>
              </Animated.View>
              {!m.from_me && m.body === AUTO_REPLY && <Text style={styles.demo}>Demo reply</Text>}
            </View>
          ))}
        </ScrollView>
        <View style={[styles.form, { paddingBottom: Math.max(12, insets.bottom) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`Message ${person(k).name}`}
            placeholderTextColor={Color.meta}
            selectionColor={Color.violet}
            keyboardAppearance="dark"
            returnKeyType="send"
            onSubmitEditing={send}
            style={styles.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} style={styles.send}>
            <Icon name="up" size={20} strokeWidth={2.4} color={Color.black} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  chat: { gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
  bubble: { maxWidth: '78%', paddingVertical: 10, paddingHorizontal: 13, borderRadius: 16 },
  me: { alignSelf: 'flex-end', backgroundColor: Color.violet, borderBottomRightRadius: 5 },
  them: { alignSelf: 'flex-start', backgroundColor: Color.surface, borderBottomLeftRadius: 5 },
  demo: { fontFamily: Font.mono, fontSize: 13, lineHeight: 16, color: Color.meta, marginLeft: 4 },
  bubbleText: { fontFamily: Font.regular, fontSize: 15, lineHeight: 21, color: Color.white },
  form: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 10, paddingHorizontal: 12 },
  input: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: Color.surface, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: Color.violet, alignItems: 'center', justifyContent: 'center' },
});
