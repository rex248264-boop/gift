/**
 * 场景主题（UI 皮肤）
 *
 * 通过匹配场景标题前缀来决定使用哪套 UI 图片：
 *   - "赛博·" → cyber（赛博朋克风格 UI）
 *   - "民国·" → minguo（民国风格 UI）
 *   - 其余      → universal（通用 UI，默认）
 */

export type SceneTheme = 'universal' | 'cyber' | 'minguo';

export function getSceneTheme(sceneTitle: string | undefined): SceneTheme {
  if (!sceneTitle) return 'universal';
  if (sceneTitle.includes('赛博')) return 'cyber';
  if (sceneTitle.includes('民国')) return 'minguo';
  // 现实 / 序章 / 终章 等使用默认（现实）UI 资源
  return 'universal';
}
