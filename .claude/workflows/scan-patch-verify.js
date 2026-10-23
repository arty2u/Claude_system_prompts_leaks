export const meta = {
  name: 'scan-patch-verify',
  description: 'Haikuでスキャン、Sonnetで個別パッチ、Sonnetで検証',
  phases: [{ title: 'Scan', model: 'haiku' }, { title: 'Patch', model: 'sonnet' }, { title: 'Verify', model: 'sonnet' }],
}
const FILES = args.files
const TASK = args.task
const FINDINGS = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object',
  properties: { file: { type: 'string' }, line: { type: 'number' }, issue: { type: 'string' } },
  required: ['file', 'issue'] } } }, required: ['findings'] }
const VERDICT = { type: 'object', properties: { ok: { type: 'boolean' }, reason: { type: 'string' } }, required: ['ok', 'reason'] }

const results = await pipeline(FILES,
  f => agent(`読み取り専用で ${f} を監査: ${TASK}`, { phase: 'Scan', model: 'haiku', effort: 'low', schema: FINDINGS }),
  r => parallel((r?.findings ?? []).map(x => async () => {
    let ok = false, reason = ''
    for (let round = 0; round < 2 && !ok; round++) {
      await agent(`${x.file} の問題を修正: ${x.issue}${reason ? `\n前回の指摘: ${reason}` : ''}`,
        { phase: 'Patch', model: 'sonnet', isolation: 'worktree' })
      const v = await agent(`独立に反証を試みよ。修正は正しいか: ${x.file} ${x.issue}`,
        { phase: 'Verify', model: 'sonnet', schema: VERDICT })
      ok = !!v?.ok; reason = v?.reason ?? ''
    }
    return { ...x, ok, reason }
  })),
)
return results.flat().filter(Boolean).filter(x => x.ok)
