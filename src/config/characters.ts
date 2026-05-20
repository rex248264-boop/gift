// Character display config: maps the speaker tag used in scripts (e.g. "他", "她")
// to a display name and optional latin alias.
//
// The script files keep abstract tags ("他" / "她" / "你") so the parser, voice
// resolution and sprite lookup stay perspective-stable. Only the *visible*
// dialogue-box name is rewritten here.
//
// Current binding (2026-05-12):
//   - All male tags (他 / 陌生访客 / 男主) display as "一凯"
//   - All female tags (她 / 女主 / 你) display as "你" (player POV)

export type CharacterDisplay = {
  display: string;        // Main display name (Chinese)
  alias?: string;         // Optional latin / English alias shown below
};

const HE: CharacterDisplay = { display: '一凯' };
const YOU: CharacterDisplay = { display: '你' };

export const characterDisplay: Record<string, CharacterDisplay> = {
  '他': HE,
  '男主': HE,
  '陌生访客': HE,
  '她': YOU,
  '女主': YOU,
  '你': YOU,
  '大小姐': { display: '大小姐' },
  '旁白': { display: '' },
};

export function resolveCharacter(speaker: string): CharacterDisplay {
  return characterDisplay[speaker] ?? { display: speaker };
}
