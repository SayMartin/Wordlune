-- Migration: add localized columns and words_subcategories table
-- Run this in Supabase SQL editor or via psql

-- add localized fields to words (if missing)
ALTER TABLE IF EXISTS words
  ADD COLUMN IF NOT EXISTS word_en text,
  ADD COLUMN IF NOT EXISTS word_sv text;

-- add localized fields to categories and subcategories
ALTER TABLE IF EXISTS categories
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_sv text;

ALTER TABLE IF EXISTS subcategories
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_sv text;

-- create join tables if missing
CREATE TABLE IF NOT EXISTS words_categories (
  word_id uuid NOT NULL,
  category_id uuid NOT NULL,
  PRIMARY KEY (word_id, category_id)
);

CREATE TABLE IF NOT EXISTS words_subcategories (
  word_id uuid NOT NULL,
  subcategory_id uuid NOT NULL,
  PRIMARY KEY (word_id, subcategory_id)
);

CREATE INDEX IF NOT EXISTS idx_words_subcategories_subcat ON words_subcategories(subcategory_id);

-- ensure indexes on words localized fields
CREATE INDEX IF NOT EXISTS idx_words_word_en ON words(word_en);
CREATE INDEX IF NOT EXISTS idx_words_word_sv ON words(word_sv);
