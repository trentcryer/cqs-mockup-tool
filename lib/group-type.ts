// Group types a member can sign up as. Stored on profiles.group_type (plain text,
// no DB constraint). Keep this list as the single source of truth for the signup
// selector and any label lookups.
export const GROUP_TYPES = ['quartet', 'chorus', 'district', 'region', 'other'] as const
export type GroupType = (typeof GROUP_TYPES)[number]

const LABELS: Record<GroupType, string> = {
  quartet: 'Quartet',
  chorus: 'Chorus',
  district: 'District',
  region: 'Region',
  other: 'Group',
}

// Human-readable label for a group_type value. Falls back to "Group" for anything
// unrecognized so older/unknown rows still render sensibly.
export function groupLabel(type: string | null | undefined): string {
  return (type && LABELS[type as GroupType]) || 'Group'
}
