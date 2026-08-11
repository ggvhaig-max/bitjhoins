import { toPng } from 'html-to-image';

export function RateGraphic() {
  return null;
}

export async function downloadRateGraphic() {
  const target = document.getElementById('rate-graphic-target');
  if (!target) return;

  try {
    const dataUrl = await toPng(target, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#020b20',
      style: { transform: 'none', margin: '0' },
    });
    const link = document.createElement('a');
    link.download = `bitjhoins-tasa-del-dia-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  } catch {
    // ignore capture errors silently
  }
}
