-- Words that cannot be typed on the on-screen keyboard for their own language,
-- which makes any round drawing them unwinnable.
--
-- 20260820_fix_english_diacritics_oland_skanor.sql fixed 31 rows of this kind,
-- but it was scoped to two seed files rather than a full audit. This is the
-- full audit, done 2026-08-25 by checking every word column against the
-- characters its language can actually produce:
--
--   en  [A-Za-z]                                    + space, hyphen
--   sv  [A-Za-zÅÄÖåäö]                              + space, hyphen
--   fr  [A-Za-zÀÂÄÅÇÉÈÊËÎÏÔÖÙÛÜŸÆŒ…]                + space, hyphen
--
-- (Keyboard.tsx's LAYOUTS and GameScreen.tsx's LETTER_PATTERNS. Space and
-- hyphen are the only non-letters any layout offers.)
--
-- Four distinct causes, not just diacritics:
--
--   * apostrophes — NUKU'ALOFA, ST GEORGE'S, ST JOHN'S. No layout has one.
--   * ampersand   — RIESE & MÜLLER. Same.
--   * parentheses — BLASINGE (BORGHOLM/MORBYLANGA), ROYAL ENFIELD (APACHE).
--     These were disambiguation metadata that leaked into the answer itself.
--     Note word_sv/word_fr already carried the bare "Bläsinge" for both rows,
--     so two identical Swedish answers is the pre-existing, working state —
--     dropping the parenthetical just brings English in line with it.
--   * diacritics in the wrong language — Ç and Ü are correct Swedish spelling
--     for MOÇAMBIQUE and MÜSLI but are not on the Swedish keyboard; Í is not
--     on the English or French one.
--
-- Where correct spelling and typeability conflict, typeability wins: a word
-- nobody can enter is worth nothing however correctly it is spelled. This is
-- the same trade-off word_en already makes for Swedish place names.
--
-- CÔTE DEIVOIRE also had a plain data error — "d'Ivoire" had its apostrophe
-- replaced by an E at some point, giving the meaningless "DEIVOIRE". Fixed to
-- COTE DIVOIRE here.
--
-- Idempotent: matches on the exact broken value, so a second run updates 0 rows.
-- migrations/seeds/*.csv are fixed to match, so a future reseed does not undo it.

begin;

-- ── English ──────────────────────────────────────────────────────────────
update words set word_en = 'BLASINGE'                where word_en = 'BLASINGE (BORGHOLM)';
update words set word_en = 'BLASINGE'                where word_en = 'BLASINGE (MORBYLANGA)';
update words set word_en = 'COTE DIVOIRE'            where word_en = 'CÔTE DEIVOIRE';
update words set word_en = 'NUKUALOFA'               where word_en = 'NUKU''ALOFA';
update words set word_en = 'RIESE MULLER'            where word_en = 'RIESE & MÜLLER';
update words set word_en = 'ROYAL ENFIELD APACHE'    where word_en = 'ROYAL ENFIELD (APACHE)';
update words set word_en = 'SAO TOME AND PRINCIPE'   where word_en = 'SAO TOME AND PRÍNCIPE';
update words set word_en = 'ST GEORGES'              where word_en = 'ST GEORGE''S';
update words set word_en = 'ST JOHNS'                where word_en = 'ST JOHN''S';

-- ── Swedish ──────────────────────────────────────────────────────────────
update words set word_sv = 'MOCAMBIQUE'              where word_sv = 'MOÇAMBIQUE';
update words set word_sv = 'MUSLI'                   where word_sv = 'MÜSLI';
update words set word_sv = 'NUKUALOFA'               where word_sv = 'NUKU''ALOFA';
update words set word_sv = 'RIESE MULLER'            where word_sv = 'RIESE & MÜLLER';
update words set word_sv = 'SAO TOME OCH PRINCIPE'   where word_sv = 'SAO TOME OCH PRÍNCIPE';
update words set word_sv = 'ST GEORGES'              where word_sv = 'ST GEORGE''S';
update words set word_sv = 'ST JOHNS'                where word_sv = 'ST JOHN''S';

-- ── French ───────────────────────────────────────────────────────────────
-- Ü stays: it IS on the French layout. Only the ampersand has to go.
--
-- CÔTE DEIVOIRE passes the spellability check in French (Ô is on that layout),
-- so it is not unplayable — but it carries the same "d'Ivoire -> DEIVOIRE"
-- corruption as the English column and is fixed here for correctness, not
-- typeability.
update words set word_fr = 'CÔTE DIVOIRE'            where word_fr = 'CÔTE DEIVOIRE';
update words set word_fr = 'NUKUALOFA'               where word_fr = 'NUKU''ALOFA';
update words set word_fr = 'RIESE MÜLLER'            where word_fr = 'RIESE & MÜLLER';
update words set word_fr = 'ROYAL ENFIELD APACHE'    where word_fr = 'ROYAL ENFIELD (APACHE)';
update words set word_fr = 'SAO TOME ET PRINCIPE'    where word_fr = 'SAO TOME AND PRÍNCIPE';
update words set word_fr = 'ST GEORGES'              where word_fr = 'ST GEORGE''S';
update words set word_fr = 'ST JOHNS'                where word_fr = 'ST JOHN''S';

commit;

-- ── Verification: every row below is still unplayable. Expect zero. ──────
select 'en' as lang, word_en as word from words where word_en !~ '^[A-Za-z \-]+$'
union all
select 'sv', word_sv from words where word_sv !~ '^[A-Za-zÅÄÖåäö \-]+$'
union all
select 'fr', word_fr from words
  where word_fr !~ '^[A-Za-zÀÂÄÅÇÉÈÊËÎÏÔÖÙÛÜŸÆŒàâäåçéèêëîïôöùûüÿæœ \-]+$'
order by lang, word;
