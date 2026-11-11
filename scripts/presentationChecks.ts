import type { Locator } from 'playwright-core';
/** CSS foreground/background luminance, composed through transparent ancestors. */
export async function textContrast(target: Locator): Promise<number> {
  return target.evaluate(el => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    const rgba = (color: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
    const blend = (front: number[], back: number[]) => front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3]));
    const styles: CSSStyleDeclaration[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) styles.unshift(getComputedStyle(node));
    let background = [255, 255, 255]; for (const style of styles) background = blend(rgba(style.backgroundColor), background);
    const foreground = blend(rgba(getComputedStyle(el).color), background);
    const luminance = (color: number[]) => color.map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
}
