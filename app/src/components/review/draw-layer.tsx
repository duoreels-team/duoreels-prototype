/**
 * Draw on the frame (prototype act.draw): pen, arrow, circle and tick in violet with a glow.
 * Finger tracking runs through gesture-handler. When you tap Next, the drawing is
 * captured as a transparent PNG (react-native-view-shot) and saved with the note;
 * the SVG is kept too so it shows instantly.
 */
import { useRef, useState, type RefObject } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewInstance } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { SvgXml } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';

import { Color } from '@/constants/brand';

export type DrawTool = 'pen' | 'line' | 'circle' | 'check';
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
  if (s.tool === 'check') {
    // A tick that fills the box you drag: short stroke down, long stroke up.
    const x0 = Math.min(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]);
    const w = Math.max(12, Math.abs(b[0] - a[0]));
    const h = Math.max(12, Math.abs(b[1] - a[1]));
    return `<path d="M${x0.toFixed(1)} ${(y0 + h * 0.55).toFixed(1)}L${(x0 + w * 0.38).toFixed(1)} ${(y0 + h).toFixed(1)}L${(x0 + w).toFixed(1)} ${y0.toFixed(1)}"/>`;
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

/** Save what's drawn as a transparent PNG; returns a local file uri. */
export async function captureDrawing(ref: RefObject<ViewInstance | null>) {
  if (!ref.current) return null;
  try {
    return await captureRef(ref as Parameters<typeof captureRef>[0], { format: 'png', quality: 1, result: 'tmpfile' });
  } catch {
    return null;
  }
}

export function DrawLayer({
  tool,
  strokes,
  onStrokes,
  onSize,
  captureTarget,
}: {
  tool: DrawTool;
  strokes: Stroke[];
  onStrokes: (s: Stroke[]) => void;
  onSize: (w: number, h: number) => void;
  /** The plain layer (no frame, no border) that becomes the PNG. */
  captureTarget: RefObject<ViewInstance | null>;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [live, setLive] = useState<Stroke | null>(null);
  const current = useRef<Stroke | null>(null);

  const begin = (x: number, y: number) => {
    current.current = { tool, pts: [[x, y], [x, y]] };
    setLive({ ...current.current });
  };
  const move = (x: number, y: number) => {
    const s = current.current;
    if (!s) return;
    s.pts = s.tool === 'pen' ? [...s.pts, [x, y]] : [s.pts[0], [x, y]];
    setLive({ ...s, pts: [...s.pts] });
  };
  const end = () => {
    if (current.current) onStrokes([...strokes, current.current]);
    current.current = null;
    setLive(null);
  };

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      scheduleOnRN(begin, e.x, e.y);
    },
    onUpdate: (e) => {
      'worklet';
      scheduleOnRN(move, e.x, e.y);
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(end);
    },
  });

  const all = live ? [...strokes, live] : strokes;

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[StyleSheet.absoluteFill, styles.layer]}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setSize({ w: width, h: height });
          onSize(width, height);
        }}>
        <View ref={captureTarget} collapsable={false} style={StyleSheet.absoluteFill} pointerEvents="none">
          {size.w > 0 && all.length > 0 && <SvgXml xml={strokesToSvg(all, size.w, size.h)} width="100%" height="100%" />}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  layer: {
    borderWidth: 2,
    borderColor: Color.violet,
  },
});
