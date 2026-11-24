import { ComingNext, TextLink } from '@/components/brand/coming-next';
import { useAuth } from '@/providers/auth-provider';

export default function MeScreen() {
  const { signOut } = useAuth();
  return (
    <ComingNext title="Me" step="step 3">
      {/* Kept until the real Me screen is built, so you can still sign out. */}
      <TextLink label="Sign out" onPress={signOut} />
    </ComingNext>
  );
}
