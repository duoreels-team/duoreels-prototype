/**
 * The video area of the review screen (prototype .player.f / .vid).
 *  • a real video (expo-video) when the version is a video file
 *  • a still frame when it's a photo or a sample (like the prototype, the clock still runs)
 *  • the empty "v1 isn't here yet" field before the first cut
 */
import { Image, type ImageSource } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Pattern, RadialGradient, Rect, Stop, Svg as InnerSvg, Path } from 'react-native-svg';

import { LogoMark } from '@/components/brand/logo-mark';
import { Color, Font } from '@/constants/brand';

export type Clock = {
  playing: boolean;
  /** Bumped when the screen wants the video to jump to `seekTo`. */
  seekNonce: number;
  seekTo: number;
};

type Props = {
  kind: 'video' | 'image' | 'empty';
  videoUrl: string | null;
  picture: ImageSource | null;
  duration: number;
  clock: Clock;
  onTime: (t: number) => void;
  onEnd: () => void;
  editorName: string;
  children?: ReactNode;
};

export function Stage({ kind, videoUrl, picture, duration, clock, onTime, onEnd, editorName, children }: Props) {
  return (
    <View style={styles.vid}>
      {kind === 'empty' ? (
        <EmptyField editorName={editorName} />
      ) : kind === 'video' && videoUrl ? (
        <VideoLayer url={videoUrl} poster={picture} clock={clock} onTime={onTime} onEnd={onEnd} />
      ) : (
        <StillLayer picture={picture} duration={duration} clock={clock} onTime={onTime} onEnd={onEnd} />
      )}
      {children}
    </View>
  );
}

/* ---------- real video ---------- */

function VideoLayer({ url, poster, clock, onTime, onEnd }: { url: string; poster: ImageSource | null; clock: Clock; onTime: (t: number) => void; onEnd: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.1;
  });

  useEffect(() => {
    const a = player.addListener('timeUpdate', (e) => onTime(e.currentTime));
    const b = player.addListener('playToEnd', onEnd);
    return () => {
      a.remove();
      b.remove();
    };
  }, [player, onTime, onEnd]);

  useEffect(() => {
    if (clock.playing) player.play();
    else player.pause();
  }, [clock.playing, player]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- expo-video seeks by setting currentTime on the player
    if (clock.seekNonce) player.currentTime = clock.seekTo;
  }, [clock.seekNonce, clock.seekTo, player]);

  return (
    <>
      {poster && <Image source={poster} style={StyleSheet.absoluteFill} contentFit="cover" />}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </>
  );
}

/* ---------- still frame with the prototype's running clock + slow zoom ---------- */

function StillLayer({ picture, duration, clock, onTime, onEnd }: { picture: ImageSource | null; duration: number; clock: Clock; onTime: (t: number) => void; onEnd: () => void }) {
  const t = useRef(clock.seekTo);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (clock.seekNonce) t.current = clock.seekTo;
  }, [clock.seekNonce, clock.seekTo]);

  useEffect(() => {
    scale.value = withTiming(clock.playing ? 1.08 : 1, { duration: clock.playing ? 8000 : 400, easing: Easing.linear });
    if (!clock.playing) return;
    if (t.current >= duration - 0.2) t.current = 0;
    const timer = setInterval(() => {
      t.current = Math.min(duration, t.current + 0.1);
      onTime(t.current);
      if (t.current >= duration) onEnd();
    }, 100);
    return () => clearInterval(timer);
  }, [clock.playing, duration, onTime, onEnd, scale]);

  const zoom = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, zoom, { transformOrigin: '50% 40%' }]}>
      {picture && <Image source={picture} style={StyleSheet.absoluteFill} contentFit="cover" />}
    </Animated.View>
  );
}

/* ---------- before v1: logo field + one light (.vid.empty / .vempty) ---------- */

const MARK =
  'M36 75.782C36 73.4648 36.6709 71.1971 37.9316 69.2529C39.1924 67.3087 40.9891 65.7711 43.1047 64.8259L120.144 30.4039C121.21 29.9276 122.378 29.7255 123.542 29.816C124.706 29.9064 125.829 30.2865 126.809 30.9217C127.788 31.5569 128.593 32.427 129.151 33.4528C129.708 34.4786 130 35.6275 130 36.7949V72.4825C130 73.4437 130.198 74.3947 130.582 75.2761C130.965 76.1575 131.526 76.9505 132.23 77.6055C132.933 78.2606 133.764 78.7637 134.671 79.0836C135.577 79.4034 136.54 79.5332 137.499 79.4647L199.003 75.0715C200.92 74.9346 202.846 75.194 204.659 75.8338C206.471 76.4735 208.133 77.4798 209.54 78.7899C210.947 80.1 212.069 81.6859 212.837 83.4487C213.604 85.2115 214 87.1134 214 89.036V182.287C214 184.588 213.339 186.84 212.095 188.776C210.851 190.711 209.076 192.248 206.984 193.203L131.907 227.478C130.841 227.964 129.669 228.176 128.5 228.092C127.331 228.008 126.201 227.632 125.215 226.998C124.229 226.364 123.418 225.493 122.856 224.464C122.294 223.435 122 222.282 122 221.11V191.221C122 190.141 121.75 189.076 121.27 188.109C120.79 187.142 120.093 186.299 119.233 185.646C118.372 184.993 117.373 184.548 116.312 184.345C115.252 184.143 114.158 184.189 113.118 184.479L53.7632 201.043C51.683 201.624 49.4967 201.715 47.3754 201.31C45.254 200.905 43.2551 200.015 41.5349 198.709C39.8148 197.403 38.42 195.717 37.4598 193.783C36.4996 191.848 36 189.718 36 187.558V75.782ZM100 101.085C100 100.19 100.24 99.3117 100.696 98.5412C101.151 97.7707 101.805 97.1365 102.589 96.705C103.373 96.2734 104.259 96.0603 105.154 96.0878C106.048 96.1153 106.919 96.3824 107.675 96.8613L153.33 125.776C154.043 126.227 154.629 126.851 155.036 127.59C155.442 128.328 155.655 129.157 155.655 130C155.655 130.843 155.442 131.673 155.036 132.411C154.629 133.15 154.043 133.773 153.33 134.224L107.675 163.139C106.919 163.618 106.048 163.885 105.154 163.913C104.259 163.94 103.373 163.727 102.589 163.296C101.805 162.864 101.151 162.23 100.696 161.459C100.24 160.689 100 159.81 100 158.915V101.085Z';

function EmptyField({ editorName }: { editorName: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0B0E' }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="logos" patternUnits="userSpaceOnUse" width="64" height="112">
            {[
              [8, 6],
              [40, 62],
              [-24, 62],
            ].map(([x, y]) => (
              <InnerSvg key={`${x}${y}`} x={x} y={y} width={34} height={37.6} viewBox="30 24 190 210">
                <Path d={MARK} fill="#fff" fillOpacity={0.07} fillRule="evenodd" />
              </InnerSvg>
            ))}
          </Pattern>
          <RadialGradient id="light" cx="50%" cy="42%" r="60%" fx="50%" fy="42%">
            <Stop offset="0" stopColor={Color.violet} stopOpacity={0.55} />
            <Stop offset="0.37" stopColor={Color.violet} stopOpacity={0.18} />
            <Stop offset="0.77" stopColor={Color.violet} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#logos)" />
        <Rect width="100%" height="100%" fill="url(#light)" />
      </Svg>
      <View style={styles.vempty}>
        <View style={styles.lit}>
          <LogoMark size={52} />
        </View>
        <Text style={styles.emptyTitle}>v1 isn’t here yet</Text>
        <Text style={styles.emptyMeta}>{editorName} is cutting the first version</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  vid: {
    height: '100%',
    aspectRatio: 9 / 16,
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: Color.black,
  },
  vempty: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  lit: {
    shadowColor: Color.violet,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyTitle: {
    fontFamily: Font.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: Color.white,
    textAlign: 'center',
  },
  emptyMeta: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Color.meta,
    textAlign: 'center',
  },
});
