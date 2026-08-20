-- The "Villages on Öland" subcategory (villages-öland.csv) never got its
-- word_en column transliterated to ASCII when English support was added —
-- word_en was left identical to word_sv/word_fr for 30 of its 60 words,
-- diacritics and all (e.g. word_en = 'FÄRJESTADEN'). Same oversight hit one
-- row of cities-sweden.csv ('SKANÖR').
--
-- This isn't just cosmetic: Keyboard.tsx's English layout has no Å/Ä/Ö keys,
-- and GameScreen.tsx's LETTER_PATTERNS.en only matches [A-Za-z] — so a
-- player with English selected who draws one of these words as their secret
-- can never type the required letter, making the round unsolvable. The CSVs
-- (migrations/seeds/villages-öland.csv, migrations/seeds/cities-sweden.csv)
-- have already been fixed for future reseeding; this migration patches the
-- same 31 rows directly in the live `words` table.
--
-- word_native is stored lowercased in `words` (see 20260819_master_seed_with_french.sql),
-- matching the CSVs' own word_native slug column, so matching on
-- lower(word_native) is safe and consistent with that convention. word_en is
-- stored uppercased on insert, so the replacement values are uppercased too.

begin;

update public.words set word_en = 'AKERBY-LOPPERSTAD' where lower(word_native) = 'akerby_lopperstad';
update public.words set word_en = 'ALBOKE' where lower(word_native) = 'alboke';
update public.words set word_en = 'ALEKLINTA' where lower(word_native) = 'aleklinta';
update public.words set word_en = 'ALVLOSA' where lower(word_native) = 'alvlosa';
update public.words set word_en = 'AS' where lower(word_native) = 'as';
update public.words set word_en = 'ASTAD' where lower(word_native) = 'astad';
update public.words set word_en = 'BAGBY' where lower(word_native) = 'bagby';
update public.words set word_en = 'BARBY' where lower(word_native) = 'barby';
update public.words set word_en = 'BINNERBACK' where lower(word_native) = 'binnerback';
update public.words set word_en = 'BJORKVIKEN' where lower(word_native) = 'bjorkviken';
update public.words set word_en = 'BLASINGE (BORGHOLM)' where lower(word_native) = 'blasinge_borgholm';
update public.words set word_en = 'BLASINGE (MORBYLANGA)' where lower(word_native) = 'blasinge_morbylanga';
update public.words set word_en = 'BODA' where lower(word_native) = 'boda';
update public.words set word_en = 'BREDSATTRA' where lower(word_native) = 'bredsattra';
update public.words set word_en = 'BROTTORP' where lower(word_native) = 'brottorp';
update public.words set word_en = 'DODEVI' where lower(word_native) = 'dodevi';
update public.words set word_en = 'DORBY' where lower(word_native) = 'dorby';
update public.words set word_en = 'ERIKSORE' where lower(word_native) = 'eriksore';
update public.words set word_en = 'FARJESTADEN' where lower(word_native) = 'farjestaden';
update public.words set word_en = 'FORA' where lower(word_native) = 'fora';
update public.words set word_en = 'FROSSLUNDA' where lower(word_native) = 'frosslunda';
update public.words set word_en = 'FURUHALL-BLARROR-SOLBERGAMARKEN' where lower(word_native) = 'furuhall_blarror_solbergamarken';
update public.words set word_en = 'GARDBY' where lower(word_native) = 'gardby';
update public.words set word_en = 'GARDSLOSA' where lower(word_native) = 'gardslosa';
update public.words set word_en = 'GARDSTORP' where lower(word_native) = 'gardstorp';
update public.words set word_en = 'GLOMMINGE' where lower(word_native) = 'glomminge';
update public.words set word_en = 'GRASGARD' where lower(word_native) = 'grasgard';
update public.words set word_en = 'GRONHOGEN' where lower(word_native) = 'gronhogen';
update public.words set word_en = 'HAGBY-BLASINGE' where lower(word_native) = 'hagby_blasinge';
update public.words set word_en = 'HALLNAS' where lower(word_native) = 'hallnas';

update public.words set word_en = 'SKANOR' where lower(word_native) = 'skanör';

commit;

-- Sanity check — should return 0 rows once the above has been applied.
-- select word_native, word_en from public.words
--   where word_en ~ '[ÅÄÖåäö]';
