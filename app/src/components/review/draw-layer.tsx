/**
 * Draw on the frame (prototype act.draw): pen, arrow, circle in violet with a glow.
 * The drawing is saved with the note as an SVG image and shown over that moment.
 */
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Color } from '@/constants/brand';

export type DrawTool = 'pen' | 'line' | 'circle';
export type Stroke = { tool: DrawTool; pts: [number, number][] };

function strokeMarkup(s: Stroke) {
  const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]];
  if (!a) return '';
  if (s.tool === 'pen') return `<path d="M${s.pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}"/>`;
  if (s.tool === 'circle') {
    const rx = Math.max(1, Math.abs(b[0] - a[0]) / 2);
    const ry = Math.max(1, Math.abs(b[1] - a[1]) / 2);
    return `<ellipse cx="${((a[0] + b[0]) / 2).toFixed(1)}" cy="${((a[1] + b[1]) / 2).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>`;
  }
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const L = 15;
  const h1 = [b[0] - L * Math.cos(ang - 0.5), b[1] - L * Math.sin(ang - 0.5)];
  const h2 = [b[0] - L * Math.cos(ang + 0.5), b[1] - L * Math.sin(ang + 0.5)];
  return `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}M${b[0]} ${b[1]}L${h1[0].toFixed(1)} ${h1[1].toFixed(1)}M${b[0]} ${b[1]}L${h2[0].toFixed(1)} ${h2[1].toFixed(1)}"/>`;
}

/** The whole drawing as one SVG image (stretches over the frame it was drawn on). */
export function strokesToSvg(strokes: Stroke[], w: number, h: number) {
  const body = strokes.map(strokeMarkup).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}" preserveAspectRatio="none" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${Color.violet}" stroke-opacity="0.35" stroke-width="10">${body}</g><g stroke="${Color.violet}" stroke-width="4.5">${body}</g></svg>`;
}

export function DrawingOverlay({ svg }: { svg: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <SvgXml xml={svg} width="100%" height="100%" />
    </View>
  );
}

export function DrawLayer({ tool, strokes, onStrokes, onSize }: { tool: DrawTool; strokes: Stroke[]; onStrokes: (s: Stroke[]) => void; onSize: (w: number, h: number) => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [live, setLive] = useState<Stroke | null>(null);
  const current = useRef<Stroke | null>(null);
  const toolRef = useRef(tool);
  const strokesRef = useRef(strokes);
  useEffect(() => {
    toolRef.current = tool;
    strokesRef.current = strokes;
  }, [tool, strokes]);

  // eslint-disable-next-line react-hooks/refs -- the handlers read refs only while a finger moves, never during render
  const pan = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const p: [number, number] = [e.nativeEvent.locationX, e.nativeEvent.locationY];
        current.current = { tool: toolRef.current, pts: [p, p] };
        setLive({ ...current.current });
      },
      onPanResponderMove: (e) => {
        const s = current.current;
        if (!s) return;
        const p: [number, number] = [e.nativeEvent.locationX, e.nativeEvent.locationY];
        s.pts = s.tool === 'pen' ? [...s.pts, p] : [s.pts[0], p];
        setLive({ ...s });
      },
      onPanResponderRelease: () => {
        if (current.current) onStrokes([...strokesRef.current, current.current]);
        current.current = null;
        setLive(null);
      },
    }),
  )[0];

  const all = live ? [...strokes, live] : strokes;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.layer]}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
        onSize(width, height);
      }}
      {...pan.panHandlers}>
      {size.w > 0 && all.length > 0 && <SvgXml xml={strokesToSvg(all, size.w, size.h)} width="100%" height="100%" />}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    borderWidth: 2,
    borderColor: Color.violet,
  },
});
