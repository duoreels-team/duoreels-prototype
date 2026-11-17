import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldLabel, Icon, MainButton, Notice, ScreenTitle, TextField, TopBar, type IconName } from '@/components/brand/ui';
import { Color, Font, Radius, Space, Type } from '@/constants/brand';
import { supabase, type Role } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const AVATAR_SIZE = 96;

const ROLES: { role: Role; icon: IconName; iconSize: number; title: string; line: string }[] = [
  { role: 'creator', icon: 'video', iconSize: 28, title: 'A creator', line: 'I make the videos' },
  { role: 'editor', icon: 'pen', iconSize: 26, title: 'An editor', line: 'I edit for creators' },
];

async function uploadAvatar(userId: string, uri: string, mimeType?: string | null) {
  const contentType = mimeType ?? 'image/jpeg';
  const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${userId}/${Date.now()}.${extension}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export default function SetUpProfileScreen() {
  const { session, profile, reloadProfile, signOut } = useAuth();
  const [nickname, setNickname] = useState(profile?.name ?? '');
  const [role, setRole] = useState<Role | null>(null);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = nickname.trim().length > 0 && role !== null;

  async function pickPhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
    }
  }

  async function save() {
    if (!ready || !session || saving) return;
    setSaving(true);
    setError(null);
    try {
      const avatarUrl = photo ? await uploadAvatar(session.user.id, photo.uri, photo.mimeType) : profile?.avatar_url ?? null;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: nickname.trim(),
          role,
          avatar_url: avatarUrl,
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);
      if (updateError) throw updateError;
      // Once the profile is marked as set up, the app opens Home by itself.
      await reloadProfile();
    } catch (e) {
      const message = String((e as Error)?.message ?? '').toLowerCase();
      setError(
        message.includes('network') || message.includes('fetch')
          ? "Can't reach Duoreels. Check your connection and try again."
          : "Couldn't save your profile. Try again.",
      );
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Back = leave sign-up and return to Welcome. */}
          <TopBar onBack={signOut} />
          <ScrollView style={styles.flex} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
            <ScreenTitle>Set up your profile</ScreenTitle>

            <View style={styles.avatarRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={photo ? 'Change profile photo' : 'Add a profile photo'}
                onPress={pickPhoto}
                style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Icon name="camera" size={28} />
                )}
              </Pressable>
            </View>

            <FieldLabel>Nickname</FieldLabel>
            <TextField
              value={nickname}
              onChangeText={setNickname}
              placeholder="What should people call you?"
              autoComplete="nickname"
              textContentType="nickname"
              returnKeyType="done"
              maxLength={40}
              accessibilityLabel="Nickname"
            />

            <FieldLabel>I&apos;m</FieldLabel>
            <View style={styles.roles} accessibilityRole="radiogroup">
              {ROLES.map((option) => {
                const selected = role === option.role;
                return (
                  <Pressable
                    key={option.role}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.title}, ${option.line}`}
                    onPress={() => setRole(option.role)}
                    style={[styles.roleCard, selected && styles.roleCardSelected]}>
                    <Icon name={option.icon} size={option.iconSize} />
                    <Text style={styles.roleTitle}>{option.title}</Text>
                    <Text style={styles.roleLine}>{option.line}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.helper}>
              Same app for both. Only the actions and the wording change. You can switch later in Me.
            </Text>

            {error && (
              <View style={styles.errorRow}>
                <Notice tone="warn">{error}</Notice>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <MainButton label="Continue" onPress={save} disabled={!ready} loading={saving} />
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
  avatarRow: {
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 4,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPressed: {
    backgroundColor: Color.control,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  roles: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    height: 110,
    borderRadius: Radius.input,
    backgroundColor: Color.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  roleCardSelected: {
    borderColor: Color.white,
    backgroundColor: Color.surfaceSelected,
  },
  roleTitle: {
    fontFamily: Font.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Color.white,
    marginTop: 4,
  },
  roleLine: {
    ...Type.label,
    fontFamily: Font.regular,
    color: Color.meta,
  },
  helper: {
    ...Type.label,
    fontFamily: Font.regular,
    lineHeight: 18,
    color: Color.meta,
    marginTop: 14,
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
