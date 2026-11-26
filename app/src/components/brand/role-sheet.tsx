/**
 * Logo button (prototype .logobtn) and the "Use Duoreels as" sheet (act.roleSheet / roleSet).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/brand/icons';
import { LogoMark } from '@/components/brand/logo-mark';
import { Color, Font } from '@/constants/brand';
import { useOverlay } from '@/providers/overlay-provider';
import { useViewRole } from '@/providers/view-role';

function RoleSheet() {
  const { role, setRole } = useViewRole();
  const { closeSheet, toast } = useOverlay();
  const options: [typeof role, IconName, number, string, string][] = [
    ['creator', 'video', 28, 'Creator', 'I make the videos'],
    ['editor', 'pen', 26, 'Editor', 'I edit for creators'],
  ];
  return (
    <View>
      <Text style={styles.t20}>Use Duoreels as</Text>
      <Text style={[styles.meta, { marginBottom: 14 }]}>Same account. Only the actions and the wording change.</Text>
      <View style={styles.roles}>
        {options.map(([key, icon, size, title, line]) => {
          const on = role === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${title}, ${line}`}
              onPress={() => {
                closeSheet();
                if (key !== role)
                  setTimeout(() => {
                    setRole(key);
                    toast(`Now in ${key} view`, undefined, false);
                  }, 260);
              }}
              style={({ pressed }) => [styles.role, on && styles.roleOn, pressed && { opacity: 0.8 }]}>
              <Icon name={icon} size={size} />
              <Text style={styles.roleTitle}>{title}</Text>
              <Text style={[styles.meta, { marginTop: -4 }]}>{line}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The logo with a small chevron — tap to switch Creator / Editor. */
export function LogoButton() {
  const { openSheet } = useOverlay();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Switch between creator and editor" onPress={() => openSheet(<RoleSheet />)} hitSlop={8} style={({ pressed }) => [styles.logo, pressed && { opacity: 0.6 }]}>
      <LogoMark size={30} />
      <Icon name="down" size={14} color={Color.meta} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  t20: { fontFamily: Font.bold, fontSize: 20, lineHeight: 24, color: Color.white, marginTop: 2, marginBottom: 4 },
  meta: { fontFamily: Font.regular, fontSize: 14, lineHeight: 20, color: Color.meta },
  roles: { flexDirection: 'row', gap: 10 },
  role: { flex: 1, height: 110, borderRadius: 12, backgroundColor: Color.surface, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', gap: 10 },
  roleOn: { borderColor: Color.white, backgroundColor: Color.surfaceSelected },
  roleTitle: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, color: Color.white },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingRight: 6, alignSelf: 'flex-start' },
});
