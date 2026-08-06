
-- canonical_normalized_en
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'canonical_normalized_en'
) INTO col_exists;
IF col_exists AND sn_en IS NOT NULL THEN
  NEW.canonical_normalized_en := normalize_text(sn_en);
END IF;

-- canonical_normalized_sv
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'canonical_normalized_sv'
) INTO col_exists;
IF col_exists AND sn_sv IS NOT NULL THEN
  NEW.canonical_normalized_sv := normalize_text(sn_sv);
END IF;

-- legacy canonical_normalized (sync with English normalized if exists)
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'canonical_normalized'
) INTO col_exists;
IF col_exists AND sn_en IS NOT NULL THEN
  NEW.canonical_normalized := normalize_text(sn_en);
END IF;

RETURN NEW;