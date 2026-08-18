-- Adds French (fr) as a third playable language alongside English/Swedish.
-- See CLAUDE.md's "Web deployment"/i18n notes and this migration's sibling
-- 20260818_cleanup_anonymous_users.sql for the project's manual-migration
-- workflow (applied via Supabase SQL editor, no automated runner).
--
-- Word/guess matching stays accent-SENSITIVE for French (by design — French
-- accents are meaningful, and the app already treats Swedish ÅÄÖ the same
-- way), so word_fr values below carry real accents where correct.

-- 1. Schema: add word_fr / name_fr columns, mirroring
--    001_add_localized_columns.sql's pattern for word_en/word_sv.
ALTER TABLE IF EXISTS words ADD COLUMN IF NOT EXISTS word_fr text;
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS name_fr text;
ALTER TABLE IF EXISTS subcategories ADD COLUMN IF NOT EXISTS name_fr text;
CREATE INDEX IF NOT EXISTS idx_words_word_fr ON words(word_fr);

-- 2. Category / subcategory names.
UPDATE categories SET name_fr = v.name_fr FROM (VALUES
  ('Geography',     'Géographie'),
  ('Vehicles',      'Véhicules'),
  ('Hydrocarbons',  'Hydrocarbures')
) AS v(name_en, name_fr)
WHERE categories.name_en = v.name_en;

UPDATE subcategories SET name_fr = v.name_fr FROM (VALUES
  ('At sea',                 'En mer'),
  ('Bicycle Brands',         'Marques de vélos'),
  ('Capitals of Africa',     'Capitales d''Afrique'),
  ('Capitals of Europe',     'Capitales d''Europe'),
  ('Capital cities',         'Capitales'),
  ('Car Brands',             'Marques de voitures'),
  ('Cities in Sweden',       'Villes de Suède'),
  ('Countries in Africa',    'Pays d''Afrique'),
  ('Countries in Europe',    'Pays d''Europe'),
  ('Countries',              'Pays'),
  ('Animals',                'Animaux'),
  ('Fruits',                 'Fruits'),
  ('Groceries',              'Épicerie'),
  ('Plants',                 'Plantes'),
  ('Vegetables',             'Légumes'),
  ('Motorcycle Brands',      'Marques de motos'),
  ('Villages on Öland',      'Villages d''Öland')
) AS v(name_en, name_fr)
WHERE subcategories.name_en = v.name_en;

-- 3. Words: brand names (car/bicycle/motorcycle) — untranslatable proper
--    nouns, word_fr = word_en, applied via the subcategory join.
UPDATE words SET word_fr = word_en
WHERE word_fr IS NULL
  AND id IN (
    SELECT w.id FROM words w
    JOIN words_subcategories ws ON ws.word_id = w.id
    JOIN subcategories s ON s.id = ws.subcategory_id
    WHERE s.name_en IN ('Bicycle Brands', 'Car Brands', 'Motorcycle Brands')
  );

-- 4. Words: Swedish place names — no French exonym, keep the correctly
--    accented Swedish spelling (word_sv) rather than the ASCII word_en form.
UPDATE words SET word_fr = word_sv
WHERE word_fr IS NULL
  AND id IN (
    SELECT w.id FROM words w
    JOIN words_subcategories ws ON ws.word_id = w.id
    JOIN subcategories s ON s.id = ws.subcategory_id
    WHERE s.name_en IN ('Cities in Sweden', 'Villages on Öland')
  );

-- 5. Words: everything else (countries, capitals, at-sea, hydrocarbons'
--    5 subcategories) — baseline to word_en (covers all countries/capitals
--    whose French spelling is unchanged), then override every word that
--    actually differs.
UPDATE words SET word_fr = word_en
WHERE word_fr IS NULL
  AND id IN (
    SELECT w.id FROM words w
    JOIN words_subcategories ws ON ws.word_id = w.id
    JOIN subcategories s ON s.id = ws.subcategory_id
    WHERE s.name_en IN (
      'Countries', 'Countries in Africa', 'Countries in Europe',
      'Capital cities', 'Capitals of Africa', 'Capitals of Europe',
      'At sea', 'Animals', 'Fruits', 'Groceries', 'Plants', 'Vegetables'
    )
  );

-- Countries (covers countries.csv + the regional africa/europe CSVs, which
-- reuse the same word_en spellings, plus the alternate spellings those
-- regional files use for a few countries, e.g. "Côte d'Ivoire" vs
-- "Cote d'Ivoire", "Czech Republic" vs "Czechia").
UPDATE words SET word_fr = v.word_fr FROM (VALUES
  ('Afghanistan','Afghanistan'),('Albania','Albanie'),('Algeria','Algérie'),
  ('Andorra','Andorre'),('Angola','Angola'),('Antigua and Barbuda','Antigua-et-Barbuda'),
  ('Argentina','Argentine'),('Armenia','Arménie'),('Australia','Australie'),
  ('Austria','Autriche'),('Azerbaijan','Azerbaïdjan'),('Bahamas','Bahamas'),
  ('Bahrain','Bahreïn'),('Bangladesh','Bangladesh'),('Barbados','Barbade'),
  ('Belarus','Biélorussie'),('Belgium','Belgique'),('Belize','Belize'),
  ('Benin','Bénin'),('Bhutan','Bhoutan'),('Bolivia','Bolivie'),
  ('Bosnia and Herzegovina','Bosnie-Herzégovine'),('Botswana','Botswana'),
  ('Brazil','Brésil'),('Brunei','Brunei'),('Bulgaria','Bulgarie'),
  ('Burkina Faso','Burkina Faso'),('Burundi','Burundi'),('Cabo Verde','Cap-Vert'),
  ('Cambodia','Cambodge'),('Cameroon','Cameroun'),('Canada','Canada'),
  ('Central African Republic','République centrafricaine'),('Chad','Tchad'),
  ('Chile','Chili'),('China','Chine'),('Colombia','Colombie'),
  ('Comoros','Comores'),('Republic of the Congo','République du Congo'),
  ('Congo','Congo'),
  ('Democratic Republic of the Congo','République démocratique du Congo'),
  ('Costa Rica','Costa Rica'),('Cote d''Ivoire','Côte d''Ivoire'),
  ('Côte d''Ivoire','Côte d''Ivoire'),('Croatia','Croatie'),('Cuba','Cuba'),
  ('Cyprus','Chypre'),('Czechia','Tchéquie'),('Czech Republic','Tchéquie'),
  ('Denmark','Danemark'),('Djibouti','Djibouti'),('Dominica','Dominique'),
  ('Dominican Republic','République dominicaine'),('Ecuador','Équateur'),
  ('Egypt','Égypte'),('El Salvador','Salvador'),
  ('Equatorial Guinea','Guinée équatoriale'),('Eritrea','Érythrée'),
  ('Estonia','Estonie'),('Eswatini','Eswatini'),('Ethiopia','Éthiopie'),
  ('Fiji','Fidji'),('Finland','Finlande'),('France','France'),
  ('Gabon','Gabon'),('Gambia','Gambie'),('Georgia','Géorgie'),
  ('Germany','Allemagne'),('Ghana','Ghana'),('Greece','Grèce'),
  ('Grenada','Grenade'),('Guatemala','Guatemala'),('Guinea','Guinée'),
  ('Guinea-Bissau','Guinée-Bissau'),('Guyana','Guyana'),('Haiti','Haïti'),
  ('Honduras','Honduras'),('Hungary','Hongrie'),('Iceland','Islande'),
  ('India','Inde'),('Indonesia','Indonésie'),('Iran','Iran'),
  ('Iraq','Irak'),('Ireland','Irlande'),('Israel','Israël'),
  ('Italy','Italie'),('Jamaica','Jamaïque'),('Japan','Japon'),
  ('Jordan','Jordanie'),('Kazakhstan','Kazakhstan'),('Kenya','Kenya'),
  ('Kiribati','Kiribati'),('North Korea','Corée du Nord'),
  ('South Korea','Corée du Sud'),('Kosovo','Kosovo'),('Kuwait','Koweït'),
  ('Kyrgyzstan','Kirghizistan'),('Laos','Laos'),('Latvia','Lettonie'),
  ('Lebanon','Liban'),('Lesotho','Lesotho'),('Liberia','Libéria'),
  ('Libya','Libye'),('Liechtenstein','Liechtenstein'),
  ('Lithuania','Lituanie'),('Luxembourg','Luxembourg'),
  ('Madagascar','Madagascar'),('Malawi','Malawi'),('Malaysia','Malaisie'),
  ('Maldives','Maldives'),('Mali','Mali'),('Malta','Malte'),
  ('Marshall Islands','Îles Marshall'),('Mauritania','Mauritanie'),
  ('Mauritius','Maurice'),('Mexico','Mexique'),('Micronesia','Micronésie'),
  ('Moldova','Moldavie'),('Monaco','Monaco'),('Mongolia','Mongolie'),
  ('Montenegro','Monténégro'),('Morocco','Maroc'),('Mozambique','Mozambique'),
  ('Myanmar','Myanmar'),('Namibia','Namibie'),('Nauru','Nauru'),
  ('Nepal','Népal'),('Netherlands','Pays-Bas'),
  ('New Zealand','Nouvelle-Zélande'),('Nicaragua','Nicaragua'),
  ('Niger','Niger'),('Nigeria','Nigéria'),
  ('North Macedonia','Macédoine du Nord'),('Norway','Norvège'),
  ('Oman','Oman'),('Pakistan','Pakistan'),('Palau','Palaos'),
  ('Panama','Panama'),
  ('Papua New Guinea','Papouasie-Nouvelle-Guinée'),
  ('Paraguay','Paraguay'),('Peru','Pérou'),('Philippines','Philippines'),
  ('Poland','Pologne'),('Portugal','Portugal'),('Qatar','Qatar'),
  ('Romania','Roumanie'),('Russia','Russie'),('Rwanda','Rwanda'),
  ('Saint Kitts and Nevis','Saint-Christophe-et-Niévès'),
  ('Saint Lucia','Sainte-Lucie'),
  ('Saint Vincent and the Grenadines','Saint-Vincent-et-les-Grenadines'),
  ('Samoa','Samoa'),('San Marino','Saint-Marin'),
  ('Sao Tome and Principe','Sao Tomé-et-Principe'),
  ('São Tomé and Príncipe','Sao Tomé-et-Principe'),
  ('Saudi Arabia','Arabie saoudite'),('Senegal','Sénégal'),
  ('Serbia','Serbie'),('Seychelles','Seychelles'),
  ('Sierra Leone','Sierra Leone'),('Singapore','Singapour'),
  ('Slovakia','Slovaquie'),('Slovenia','Slovénie'),
  ('Solomon Islands','Îles Salomon'),('Somalia','Somalie'),
  ('South Africa','Afrique du Sud'),('South Sudan','Soudan du Sud'),
  ('Spain','Espagne'),('Sri Lanka','Sri Lanka'),('Sudan','Soudan'),
  ('Suriname','Suriname'),('Sweden','Suède'),('Switzerland','Suisse'),
  ('Syria','Syrie'),('Taiwan','Taïwan'),('Tajikistan','Tadjikistan'),
  ('Tanzania','Tanzanie'),('Thailand','Thaïlande'),
  ('Timor-Leste','Timor oriental'),('Togo','Togo'),('Tonga','Tonga'),
  ('Trinidad and Tobago','Trinité-et-Tobago'),('Tunisia','Tunisie'),
  ('Turkey','Turquie'),('Turkmenistan','Turkménistan'),('Tuvalu','Tuvalu'),
  ('Uganda','Ouganda'),('Ukraine','Ukraine'),
  ('United Arab Emirates','Émirats arabes unis'),
  ('United Kingdom','Royaume-Uni'),('United States','États-Unis'),
  ('Uruguay','Uruguay'),('Uzbekistan','Ouzbékistan'),('Vanuatu','Vanuatu'),
  ('Vatican City','Cité du Vatican'),('Venezuela','Venezuela'),
  ('Vietnam','Vietnam'),('Yemen','Yémen'),('Zambia','Zambie'),
  ('Zimbabwe','Zimbabwe'),('Western Sahara','Sahara occidental')
) AS v(word_en, word_fr)
WHERE words.word_en = v.word_en;

-- Capitals that differ from English (all other capitals keep the baseline
-- identity set in step 5 above).
UPDATE words SET word_fr = v.word_fr FROM (VALUES
  ('Vienna','Vienne'),('Copenhagen','Copenhague'),('Athens','Athènes'),
  ('Warsaw','Varsovie'),('Lisbon','Lisbonne'),('Bucharest','Bucarest'),
  ('Moscow','Moscou'),('London','Londres'),('Brussels','Bruxelles'),
  ('Bern','Berne'),('Cairo','Le Caire'),('Algiers','Alger'),
  ('Addis Ababa','Addis-Abeba'),('Beijing','Pékin'),('Seoul','Séoul'),
  ('Manila','Manille'),('Jerusalem','Jérusalem'),('Baghdad','Bagdad'),
  ('Damascus','Damas'),('Beirut','Beyrouth'),('Tehran','Téhéran'),
  ('Kuwait City','Koweït'),('Muscat','Mascate'),('Riyadh','Riyad'),
  ('Sana''a','Sanaa'),('Abu Dhabi','Abou Dabi'),('Singapore','Singapour'),
  ('Hanoi','Hanoï'),('Ulaanbaatar','Oulan-Bator'),('Ashgabat','Achgabat'),
  ('Tashkent','Tachkent'),('Bishkek','Bichkek'),('Dushanbe','Douchanbé'),
  ('Baku','Bakou'),('Tbilisi','Tbilissi'),('Yerevan','Erevan'),
  ('Kyiv','Kiev'),('Andorra la Vella','Andorre-la-Vieille'),
  ('San Marino','Saint-Marin'),('Vatican City','Cité du Vatican'),
  ('Nicosia','Nicosie'),('Valletta','La Valette'),('Lome','Lomé'),
  ('Yaounde','Yaoundé'),('Sao Tome','Sao Tomé'),('Laayoune','Laâyoune'),
  ('Athens','Athènes'),('Prague','Prague'),('Bratislava','Bratislava')
) AS v(word_en, word_fr)
WHERE words.word_en = v.word_en;

-- Ship-type generic terms in at-sea.csv (boat brand rows before "Yacht" in
-- that file already got identity treatment from step 5's baseline).
UPDATE words SET word_fr = v.word_fr FROM (VALUES
  ('Yacht','Yacht'),('Sailboat','Voilier'),('Motorboat','Bateau à moteur'),
  ('Fishing Boat','Bateau de pêche'),('Trawler','Chalutier'),
  ('Cargo Ship','Cargo'),('Tanker','Pétrolier'),
  ('Container Ship','Porte-conteneurs'),('Bulk Carrier','Vraquier'),
  ('Ferry','Ferry'),('Cruise Ship','Paquebot'),('Ro-Ro','Roulier'),
  ('Catamaran','Catamaran'),('Trimaran','Trimaran'),('Speedboat','Vedette'),
  ('Dinghy','Canot'),('Lifeboat','Canot de sauvetage'),
  ('Patrol Boat','Patrouilleur'),('Destroyer','Contre-torpilleur'),
  ('Frigate','Frégate'),('Submarine','Sous-marin'),
  ('Aircraft Carrier','Porte-avions'),('Hovercraft','Aéroglisseur'),
  ('Tugboat','Remorqueur'),('Barge','Péniche'),
  ('Research Vessel','Navire de recherche'),
  ('Offshore Support','Navire de soutien'),('Icebreaker','Brise-glace'),
  ('Dredger','Drague'),('Sailing Yacht','Yacht à voiles'),
  ('Houseboat','Bateau habitable')
) AS v(word_en, word_fr)
WHERE words.word_en = v.word_en;

-- Hydrocarbons: animals (common nouns, all translated).
UPDATE words SET word_fr = v.word_fr FROM (VALUES
  ('TIGER','TIGRE'),('ZEBRA','ZÈBRE'),('PANDA','PANDA'),('KOALA','KOALA'),
  ('CAMEL','CHAMEAU'),('OTTER','LOUTRE'),('HYENA','HYÈNE'),('LION','LION'),
  ('BEAR','OURS'),('RABBIT','LAPIN'),('MAGPIE','PIE'),('CROW','CORNEILLE'),
  ('OWL','HIBOU'),('CRANE','GRUE'),('PHEASANT','FAISAN'),('BEAVER','CASTOR'),
  ('TOAD','CRAPAUD'),('LEMUR','LÉMURIEN'),('PIKE','BROCHET'),('HERON','HÉRON'),
  ('CORMORANT','CORMORAN'),('MOSQUITO','MOUSTIQUE'),('FLY','MOUCHE'),
  ('RAT','RAT'),('TAPIR','TAPIR'),('MONITOR','VARAN'),('GUPPY','GUPPY'),
  ('KITTY','MINET'),('STORK','CIGOGNE'),('COBRA','COBRA'),('SOW','TRUIE'),
  ('JELLYFISH','MÉDUSE'),('EAGLE','AIGLE'),('SHARK','REQUIN'),('MOOSE','ÉLAN'),
  ('SNAKE','SERPENT'),('HORSE','CHEVAL'),('MOUSE','SOURIS'),('SHEEP','MOUTON'),
  ('PUPPY','CHIOT'),('GOOSE','OIE'),('RAVEN','CORBEAU'),('ROBIN','ROUGEGORGE'),
  ('WHALE','BALEINE'),('BISON','BISON'),('VIPER','VIPÈRE'),('SLOTH','PARESSEUX'),
  ('PUFFER','FUGU'),('BADGER','BLAIREAU'),('FALCON','FAUCON'),('EWE','BREBIS'),
  ('CARP','CARPE'),('MINK','VISON'),('VOLE','CAMPAGNOL'),('LYNX','LYNX'),
  ('WEASEL','BELETTE'),('FERRET','FURET'),('MOLE','TAUPE'),
  ('SHREW','MUSARAIGNE'),('BAT','CHAUVE-SOURIS'),('FOX','RENARD'),
  ('WOLF','LOUP'),('JACKAL','CHACAL')
) AS v(word_en, word_fr)
WHERE words.word_en = v.word_en;

-- Hydrocarbons: fruits.
UPDATE words SET word_fr = v.word_fr FROM (VALUES
  ('APPLE','POMME'),('MELON','MELON'),('MANGO','MANGUE'),('GUAVA','GOYAVE'),
  ('PEAR','POIRE'),('DATE','DATTE'),('FIG','FIGUE'),('BANANA','BANANE'),
  ('COCONUT','NOIX DE COCO'),('COCOA','CACAO'),('ROSEHIP','ÉGLANTINE'),
  ('GRAPE','RAISIN'),('AGAVE','AGAVE'),('TOMATO','TOMATE'),
  ('PUMPKIN','CITROUILLE'),('BERRY','BAIE'),('PEACH','PÊCHE'),
  ('LEMON','CITRON'),('PEARS','POIRES'),('PLUMS','PRUNES'),('DATES','DATTES'),
  ('LIMES','CITRONS VERTS'),('KIWIS','KIWIS'),('SEEDS','GRAINES')
) AS v(word_en, word_fr)
WHERE words.word_en = v.word_en;

-- Hydrocarbons: groceries.
UPDATE words SET word_fr = v.word_fr FROM (VALUES
  ('CANDY','BONBON'),('PIZZA','PIZZA'),('TACOS','TACOS'),('SUSHI','SUSHI'),
  ('PASTA','PÂTES'),('LOAF','MICHE'),('SYRUP','SIROP'),('CINNAMON','CANNELLE'),
  ('MILK','LAIT'),('PORK','PORC'),('SAUSAGE','SAUCISSE'),('KEFIR','KÉFIR'),
  ('MUESLI','MUESLI'),('COFFEE','CAFÉ'),('CIDER','CIDRE'),('JUICE','JUS'),
  ('MUSTARD','MOUTARDE'),('SALSA','SALSA'),('COD','CABILLAUD'),
  ('STOUT','STOUT'),('NOODLE','NOUILLE'),('BAGEL','BAGEL'),('SOUP','SOUPE'),
  ('CHIPS','CHIPS'),('CRISPS','CHIPS'),('FLOUR','FARINE'),('SUGAR','SUCRE'),
  ('BREAD','PAIN'),('SPICE','ÉPICE'),('SALTS','SELS'),('SAUCE','SAUCE'),
  ('WATER','EAU'),('CREAM','CRÈME'),('YEAST','LEVURE'),('HONEY','MIEL'),
  ('CAKES','GÂTEAUX'),('STEAK','STEAK'),('ONION','OIGNON')
) AS v(word_en, word_fr)
WHERE words.word_en = v.word_en;

-- Hydrocarbons: plants.
UPDATE words SET word_fr = v.word_fr FROM (VALUES
  ('LILAC','LILAS'),('LOTUS','LOTUS'),('WEED','MAUVAISE HERBE'),
  ('BIRCH','BOULEAU'),('CEDAR','CÈDRE'),('BUSH','BUISSON'),('LILY','LYS'),
  ('ASTER','ASTER'),('FLORA','FLORE'),('BUD','BOURGEON'),('MOSS','MOUSSE'),
  ('YUCCA','YUCCA'),('HEATHER','BRUYÈRE'),('GRASS','HERBE'),('TULIP','TULIPE'),
  ('ROSES','ROSES'),('FERNS','FOUGÈRES'),('WEEDS','MAUVAISES HERBES'),
  ('ROOTS','RACINES'),('SEEDS','GRAINES'),('BLOOM','FLORAISON'),
  ('STALK','TIGE'),('TREES','ARBRES'),('ASPEN','TREMBLE'),('MAPLE','ÉRABLE'),
  ('BEECH','HÊTRE'),('PINES','PINS')
) AS v(word_en, word_fr)
WHERE words.word_en = v.word_en;

-- Hydrocarbons: vegetables.
UPDATE words SET word_fr = v.word_fr FROM (VALUES
  ('CUCUMBER','CONCOMBRE'),('CARROT','CAROTTE'),('BEANS','HARICOTS'),
  ('BEETS','BETTERAVES'),('MUSHROOM','CHAMPIGNON'),('LEEK','POIREAU'),
  ('CHILI','PIMENT'),('PEAS','POIS'),('MAIZE','MAÏS'),('CHARD','BLETTE'),
  ('LEEKS','POIREAUX'),('HERBS','HERBES'),('CRESS','CRESSON'),
  ('OLIVE','OLIVE'),('SAVOY','CHOU FRISÉ'),('CABBAGE','CHOU'),
  ('SPINACH','ÉPINARD'),('RADISH','RADIS'),('CILANTRO','CORIANDRE'),
  ('ARTICHOKE','ARTICHAUT'),('ZUCCHINI','COURGETTE')
) AS v(word_en, word_fr)
WHERE words.word_en = v.word_en;

-- 6. Safety net: anything still without a translation (should be none, but
--    covers stray/malformed seed rows) falls back to identity.
UPDATE words SET word_fr = word_en WHERE word_fr IS NULL;
