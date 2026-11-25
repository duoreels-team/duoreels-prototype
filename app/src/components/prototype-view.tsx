'use dom';

import type { DOMProps } from 'expo/dom';

/**
 * Shows the live HTML prototype full screen inside the app (Expo DOM component).
 * The prototype draws its own tab bar, so the app adds no chrome around it.
 */
export default function PrototypeView({ url }: { url: string; dom?: DOMProps }) {
  return (
    <>
      <style>{'html,body{margin:0;background:#000;}'}</style>
      <iframe
        src={url}
        title="Duoreels prototype"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          border: 'none',
          background: '#000',
        }}
      />
    </>
  );
}
