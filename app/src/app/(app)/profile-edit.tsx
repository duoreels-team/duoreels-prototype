/**
 * NEW · Edit profile: photo (→ "avatars" bucket), name, city, short bio. Saves to profiles.
 */
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, BigButton } from '@/components/brand/bits';
import { Icon } from '@/components/brand/icons';
import { PageTop } from '@/components/brand/top-bar';
import { Color, Font, Space } from '@/constants/brand';
import { useSaveProfile } from '@/lib/me';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useOverlay } from '@/providers/overlay-provider';

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const save = useSaveProfile();
  const { toast } = useOverlay();
  const [name, setName] = useState(profile?.name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0]);
  }

  async function onSave() {
    if (!name.trim()) {
      toast('Add your name first', undefined, false);
      return;
    }
    setSaving(true);
    let avatar_url = profile?.avatar_url ?? null;
    if (photo && session) {
      try {
        const type = photo.mimeType ?? 'image/jpeg';
        const path = `${session.user.id}/${Date.now()}.${type.includes('png') ? 'png' : 'jpg'}`;
        const body = await (await fetch(photo.uri)).arrayBuffer();
        const up = await supabase.storage.from('avatars').upload(path, body, { contentType: type });
        if (up.error) throw up.error;
        avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      } catch {
        setSaving(false);
        toast("Couldn't upload your photo · try again");
        return;
      }
    }
    const err = await save({ name: name.trim(), city: city.trim() || null, bio: bio.trim() || null, avatar_url });
    setSaving(false);
    if (err) {
      toast(err);
      return;
    }
    router.back();
    toast('Profile saved');
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <PageTop title="Edit profile" sub="Editors see this on your projects" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={pick} style={styles.photoWrap}>
            {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" /> : <Avatar k="M" size={96} />}
            <View style={styles.camera}>
              <Icon name="camera" size={16} color={Color.black} />
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={pick} hitSlop={8} style={{ alignSelf: 'center', marginTop: 8 }}>
            <Text style={[styles.meta, { color: Color.violet }]}>Change photo</Text>
          </Pressable>

          <Text style={styles.lbl}>NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={Color.meta} maxLength={40} selectionColor={Color.violet} keyboardAppearance="dark" style={styles.field} />
          <Text style={styles.lbl}>CITY</Text>
          <TextInput value={city} onChangeText={setCity} placeholder="e.g. Los Angeles" placeholderTextColor={Color.meta} maxLength={40} selectionColor={Color.violet} keyboardAppearance="dark" style={styles.field} />
          <Text style={styles.lbl}>SHORT BIO</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={160}
            placeholder="What you make, in one line"
            placeholderTextColor={Color.meta}
            selectionColor={Color.violet}
            keyboardAppearance="dark"
            style={[styles.field, styles.bio]}
          />
          <Text style={[styles.meta, { textAlign: 'right', marginTop: 6 }]}>{bio.length} / 160</Text>

          <BigButton label="Save" loading={saving} onPress={onSave} style={{ marginTop: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Color.black },
  pad: { paddingHorizontal: Space.screenEdge },
  photoWrap: { alignSelf: 'center', marginTop: 12 },
  photo: { width: 96, height: 96, borderRadius: 48 },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: Color.white, alignItems: 'center', justifyContent: 'center' },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  lbl: { fontFamily: Font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, color: Color.meta, marginTop: 20, marginBottom: 8 },
  field: { height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Color.surface, fontFamily: Font.regular, fontSize: 15, color: Color.white },
  bio: { height: 96, paddingTop: 13, textAlignVertical: 'top' },
});
