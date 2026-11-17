import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldLabel, MainButton, Notice, ScreenTitle, TextField, TopBar } from '@/components/brand/ui';
import { Color, Font, Radius, Space, Type } from '@/constants/brand';
import { useAuth } from '@/providers/auth-provider';

const CODE_LENGTH = 6;
// Supabase only lets you ask for a new code once every 60 seconds.
const RESEND_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mmss(total: number) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function SignInWithEmailScreen() {
  const { sendCode, verifyCode } = useAuth();

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codeInput = useRef<TextInputInstance>(null);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const codeSent = sentTo !== null && sentTo === email.trim().toLowerCase();
  const codeComplete = code.length === CODE_LENGTH;

  // Count down to "Resend".
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function send() {
    if (!emailValid || busy) return;
    setBusy('send');
    setError(null);
    const problem = await sendCode(email);
    setBusy(null);
    if (problem) {
      setError(problem);
      return;
    }
    setSentTo(email.trim().toLowerCase());
    setCode('');
    setSecondsLeft(RESEND_SECONDS);
    setTimeout(() => codeInput.current?.focus(), 50);
  }

  async function verify(value = code) {
    if (value.length !== CODE_LENGTH || busy || !sentTo) return;
    setBusy('verify');
    setError(null);
    const problem = await verifyCode(sentTo, value);
    setBusy(null);
    if (problem) {
      setError(problem);
      setCode('');
      codeInput.current?.focus();
    }
    // On success the app moves on by itself: Home, or Set up your profile the first time.
  }

  function onCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === CODE_LENGTH) {
      setTimeout(() => verify(digits), 350);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TopBar />
          <ScrollView style={styles.flex} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
            <ScreenTitle>Sign in with email</ScreenTitle>

            <FieldLabel>Email</FieldLabel>
            <TextField
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError(null);
              }}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={send}
              autoFocus
              accessibilityLabel="Email"
            />

            {codeSent && (
              <>
                <FieldLabel>Code</FieldLabel>
                <Text style={styles.sentLine}>We sent a 6-digit code to {sentTo}.</Text>

                <Pressable
                  onPress={() => codeInput.current?.focus()}
                  accessibilityLabel={`Code, ${code.length} of ${CODE_LENGTH} digits entered`}
                  style={styles.codeRow}>
                  {Array.from({ length: CODE_LENGTH }, (_, i) => {
                    const digit = code[i] ?? '';
                    const active = i === Math.min(code.length, CODE_LENGTH - 1) && !codeComplete;
                    return (
                      <View key={i} style={[styles.codeBox, digit !== '' && styles.codeBoxFilled, active && styles.codeBoxActive]}>
                        <Text style={styles.codeDigit}>{digit}</Text>
                      </View>
                    );
                  })}
                </Pressable>
                {/* One hidden input drives the six boxes: typing fills the next box, backspace clears the last. */}
                <TextInput
                  ref={codeInput}
                  value={code}
                  onChangeText={onCodeChange}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={CODE_LENGTH}
                  caretHidden
                  style={styles.hiddenInput}
                  importantForAccessibility="no"
                />

                <View style={styles.resendRow}>
                  {secondsLeft > 0 ? (
                    <Text style={styles.meta}>
                      Resend in <Text style={styles.mono}>{mmss(secondsLeft)}</Text>
                    </Text>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={send} hitSlop={12} disabled={busy !== null}>
                      <Text style={styles.resend}>{busy === 'send' ? 'Sending…' : 'Resend code'}</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {error && (
              <View style={styles.errorRow}>
                <Notice tone="warn">{error}</Notice>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {codeSent ? (
              <MainButton label="Sign in" onPress={() => verify()} disabled={!codeComplete} loading={busy === 'verify'} />
            ) : (
              <MainButton label="Send code" onPress={send} disabled={!emailValid} loading={busy === 'send'} />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Color.black,
  },
  flex: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: Space.screenEdge,
    paddingBottom: Space.groups,
  },
  sentLine: {
    ...Type.label,
    fontFamily: Font.regular,
    lineHeight: 18,
    color: Color.meta,
    marginTop: -2,
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    gap: Space.base,
    marginTop: 4,
  },
  codeBox: {
    flex: 1,
    maxWidth: 52,
    height: 58,
    borderRadius: Radius.input,
    backgroundColor: Color.surface,
    borderWidth: 1.5,
    borderColor: Color.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxFilled: {
    borderColor: Color.white,
  },
  codeBoxActive: {
    borderColor: Color.violet,
  },
  codeDigit: {
    fontFamily: Font.semibold,
    fontSize: 22,
    lineHeight: 28,
    color: Color.white,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendRow: {
    marginTop: 12,
    minHeight: 20,
  },
  meta: {
    ...Type.label,
    fontFamily: Font.regular,
    color: Color.meta,
  },
  mono: {
    fontFamily: Font.mono,
    fontSize: 12,
    color: Color.meta,
  },
  resend: {
    ...Type.label,
    color: Color.violet,
  },
  errorRow: {
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: Space.screenEdge,
    paddingTop: Space.base,
    paddingBottom: Space.screenEdge,
  },
});
