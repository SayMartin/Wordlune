import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useLoading } from "../context/LoadingContext";
import {
  listCategories,
  listSubcategories,
  listWordsSubcategories,
} from "../supabase/words-repository";
import Toggle from "./Toggle";

type Category = { id: string; name: string; slug?: string };
type Subcategory = { id: string; name: string; category_id: string };

interface Props {
  onChange: (selectedSubcategoryIds: string[] | null) => void;
  onCountChange?: (count: number) => void;
  disabled?: boolean;
  headerContent?: React.ReactNode;
  highlightedSubcategoryIds?: string[];
}

export default function CategorySelector({
  onChange,
  onCountChange,
  disabled = false,
  headerContent,
  highlightedSubcategoryIds,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { show, hide } = useLoading();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedSubs, setSelectedSubs] = useState<Record<string, boolean>>({});
  const [subcategoryCounts, setSubcategoryCounts] = useState<Record<string, number>>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (disabled) setCollapsed(true);
  }, [disabled]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const rawLang = (i18n && i18n.language) || "en";
      const lang = String(rawLang).split("-")[0];
      try {
        show(t("loading_data"));
        const catsArr = await listCategories(lang);
        const catIds = catsArr.map((c: any) => c.id);
        const subsArr = await listSubcategories(lang, catIds);
        if (!mounted) return;
        setCategories(catsArr);
        setSubcategories(subsArr);

        if (subsArr.length > 0) {
          const subMap: Record<string, boolean> = {};
          subsArr.forEach((s: any) => (subMap[s.id] = true));
          setSelectedSubs(subMap);
        }

        try {
          const subIds = subsArr.map((s: any) => s.id);
          if (subIds.length > 0) {
            const rels = await listWordsSubcategories(subIds);
            const subMap: Record<string, Set<string>> = {};
            (rels ?? []).forEach((r: any) => {
              const sid = r.subcategory_id;
              const wid = r.word_id;
              if (!sid || !wid) return;
              if (!subMap[sid]) subMap[sid] = new Set();
              subMap[sid].add(wid);
            });
            const subCounts: Record<string, number> = {};
            Object.keys(subMap).forEach((k) => (subCounts[k] = subMap[k].size));

            const catCounts: Record<string, number> = {};
            catsArr.forEach((c: any) => {
              const subsOfCat = subsArr.filter((s: any) => s.category_id === c.id);
              catCounts[c.id] = subsOfCat.reduce((acc: number, s: any) => acc + (subCounts[s.id] ?? 0), 0);
            });

            if (!mounted) return;
            setSubcategoryCounts(subCounts);
            setCategoryCounts(catCounts);
          }
        } catch (err) {
          console.error("CategorySelector counts", err);
        }
      } catch (err) {
        console.error("CategorySelector load", err);
      } finally {
        hide();
        if (mounted) setLoaded(true);
      }
    }
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n?.language]);

  useEffect(() => {
    const selected = Object.keys(selectedSubs).filter((k) => selectedSubs[k]);
    onChange(selected.length === 0 ? null : selected);
  }, [selectedSubs, onChange]);

  useEffect(() => {
    if (!onCountChange) return;
    const allSubIds = subcategories.map((s) => s.id);
    const selected = Object.keys(selectedSubs).filter((k) => selectedSubs[k]);
    const ids = selected.length === 0 ? allSubIds : selected;
    const total = ids.reduce((acc, id) => acc + (subcategoryCounts[id] ?? 0), 0);
    onCountChange(total);
  }, [selectedSubs, subcategoryCounts, subcategories, onCountChange]);

  function toggleSub(subId: string) {
    setSelectedSubs((s) => ({ ...s, [subId]: !s[subId] }));
  }

  function selectedSubsOfCat(catId: string) {
    return subcategories.filter((s) => s.category_id === catId);
  }

  function allSelectedInCat(catId: string) {
    const subsOfCat = selectedSubsOfCat(catId);
    return subsOfCat.length > 0 && subsOfCat.every((s) => !!selectedSubs[s.id]);
  }

  function toggleCategory(catId: string) {
    const subsOfCat = selectedSubsOfCat(catId);
    const allSelected = allSelectedInCat(catId);
    setSelectedSubs((s) => {
      const copy = { ...s };
      subsOfCat.forEach((sc) => {
        copy[sc.id] = !allSelected;
      });
      return copy;
    });
  }

  const selectedCount = Object.values(selectedSubs).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          style={[styles.expandButton, { borderColor: colors.border }, disabled && styles.disabled]}
          onPress={() => !disabled && setCollapsed((c) => !c)}
          disabled={disabled}
        >
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            {t("select_categories", { defaultValue: "Categories" })} ({selectedCount}) {collapsed ? "▸" : "▾"}
          </Text>
        </Pressable>
        {headerContent}
      </View>

      {!collapsed && (
        <View style={styles.list}>
          {categories.length === 0 && loaded ? (
            <Text style={{ color: colors.textMuted, padding: 8 }}>
              {t("no_categories_found", { defaultValue: "No categories found." })}
            </Text>
          ) : (
            categories.map((cat) => {
              const subsOfCat = selectedSubsOfCat(cat.id);
              return (
                <View key={cat.id} style={[styles.categoryCard, { borderColor: colors.border }]}>
                  <View style={styles.categoryHeaderRow}>
                    <Text style={[styles.categoryTitle, { color: colors.text }]}>
                      {cat.name} ({subsOfCat.filter((s) => selectedSubs[s.id]).length}/{categoryCounts[cat.id] ?? 0})
                    </Text>
                    <Toggle checked={allSelectedInCat(cat.id)} onChange={() => toggleCategory(cat.id)} />
                  </View>
                  <View style={styles.subGrid}>
                    {subsOfCat.map((sub) => {
                      const isHighlighted = highlightedSubcategoryIds?.includes(sub.id);
                      return (
                        <Pressable
                          key={sub.id}
                          style={styles.subRow}
                          onPress={() => toggleSub(sub.id)}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              { borderColor: colors.border },
                              selectedSubs[sub.id] && styles.checkboxChecked,
                            ]}
                          />
                          <Text
                            style={{
                              color: isHighlighted ? "#f59e0b" : colors.text,
                              fontWeight: isHighlighted ? "700" : "400",
                              fontSize: 13,
                            }}
                          >
                            {sub.name} ({subcategoryCounts[sub.id] ?? 0})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 8 },
  expandButton: {
    height: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexShrink: 1,
  },
  disabled: { opacity: 0.5 },
  list: { gap: 10 },
  categoryCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  categoryHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryTitle: { fontWeight: "700", fontSize: 14 },
  subGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, width: "45%" },
  checkbox: { width: 16, height: 16, borderWidth: 1.5, borderRadius: 4 },
  checkboxChecked: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
});
