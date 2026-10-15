// Values that change between releases live here (the export step renders v0.1.1).
export const TAG = 'v0.1.1'
// The GitHub account that hosts Sitebrew. In the sources it is a placeholder (underscores are not allowed in a GitHub name); while it is left, the CLI stops before it downloads anything.
export const DEFAULT_OWNER = 'nowwcastle-sudo'
// compared with a split literal so that the fill-in cannot change the comparison
export const OWNER_PLACEHOLDER = ['__', 'OWNER__'].join('')
export const REPO = 'sitebrew'
export const DEFAULT_FOLDER = 'sitebrew'
export const MARKETPLACE = 'sitebrew'
export const PLUGIN = 'sitebrew'

// What the user types next: Claude Code has a slash command; Codex starts a plugin skill from a plain request.
export const NEXT_STEP_CODEX = { ko: '"sitebrew new 스킬을 써 줘"라고 말하세요', en: 'say: "use the sitebrew new skill"' }
export const NEXT_STEP_CLAUDE = '/sitebrew:new'
