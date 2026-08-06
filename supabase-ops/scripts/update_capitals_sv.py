#!/usr/bin/env python3
import csv

p='migrations/capital-cities.csv'
# Curated Swedish spellings for capitals that commonly differ
sw_map={
    'Copenhagen':'Köpenhamn',
    'Brussels':'Bryssel',
    'Prague':'Prag',
    'Rome':'Rom',
    'Vienna':'Wien',
    'Lisbon':'Lissabon',
    'Athens':'Aten',
    'Bucharest':'Bukarest',
    'Belgrade':'Belgrad',
    'Moscow':'Moskva',
    'Kyiv':'Kiev',
    'Kiev':'Kiev',
    'Warsaw':'Warszawa',
    'Paris':'Paris',
    'Stockholm':'Stockholm',
    'Oslo':'Oslo',
    'Helsinki':'Helsinki',
    'Reykjavik':'Reykjavik',
    'Bern':'Bern',
    'Valletta':'Valletta',
    'Amsterdam':'Amsterdam',
    'Berlin':'Berlin',
    'Madrid':'Madrid'
}

rows=[]
changed=[]
with open(p,newline='',encoding='utf-8') as f:
    reader=csv.reader(f)
    for i,row in enumerate(reader):
        if i==0:
            rows.append(row)
            continue
        if len(row)<3:
            rows.append(row)
            continue
        en=row[1].strip()
        sv=sw_map.get(en,en)
        if row[2]!=sv:
            row[2]=sv
            changed.append((i+1,en,sv))
        rows.append(row)

with open(p,'w',newline='',encoding='utf-8') as f:
    writer=csv.writer(f)
    writer.writerows(rows)

print('Updated',len(changed),'rows. Sample changes:')
for c in changed[:20]:
    print(c)
