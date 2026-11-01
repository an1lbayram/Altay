#!/usr/bin/env python3
"""Turkiye tarihi yer verisini OpenStreetMap'ten hazirlar.

Altay, Turkiye icinde tarihi yerleri canli Overpass sunucularindan degil, bu betigin
urettigi statik dosyalardan okur (public/data/poi). Herkese acik Overpass ornekleri
2026'dan beri IP basina gunluk kota uyguluyor ve sik sik yanit vermiyor; Fethiye gibi
yerlerde "hic tarihi yer yok" gorunmesinin sebebi buydu.

Kullanim (haftalik is akisi: .github/workflows/update-poi-data.yml):
    python3 scripts/build_poi_data.py turkey-latest.osm.pbf public/data/poi

Adimlar:
  1. Filtre: historic=*, tourism=museum|attraction, amenity=place_of_worship tasiyan
     nesneler + geometrileri icin referans verdikleri yollar/noktalar -> kucuk ara PBF.
  2. Her eleman icin Overpass'in "out center" ciktisiyla ayni merkez: nokta ise kendi
     konumu, yol/iliski ise sinir kutusunun ortasi.
  3. 0,5 derecelik hucrelere bolme. Iki katman var:
       core/    tarihi + muze + turistik (kategori "ibadethane" disindaki her sey)
       worship/ yalnizca amenity=place_of_worship olanlar (sadece "ibadethane" yukler)
     Boylece varsayilan aramada on binlerce camii indirilmiyor.

Uygulamanin kategori filtreleri src/js/services/poiCategories.js icinde; bu betik
hepsinin birlesimini toplar, ayrimi istemci yapar.
"""

import json
import math
import shutil
import sys
import tempfile
from pathlib import Path

import osmium

CELL_SIZE = 0.5
COORD_DIGITS = 6
FORMAT_VERSION = 1

# Uygulamanin gercekten okudugu etiketler (src/ altinda tags.* kullanimlari). Geri kalanlar
# dosya boyutunu sisirmesin diye atiliyor.
KEEP_TAGS = {
    "name", "name:tr", "name:en", "alt_name", "official_name",
    "historic", "tourism", "amenity", "information", "memorial:type", "historic_period",
    "wikipedia", "wikidata", "subject:wikidata", "image", "wikimedia_commons",
    "heritage", "heritage_operator", "unesco", "start_date", "building:year", "architect",
    "description", "note",
}


def is_core(tags):
    return "historic" in tags or tags.get("tourism") in ("museum", "attraction")


def is_worship(tags):
    return tags.get("amenity") == "place_of_worship"


def wanted(tags):
    return is_core(tags) or is_worship(tags)


def filter_extract(src, dst):
    """Eslesen nesneleri ve geometri icin gereken referanslari kucuk bir PBF'e yazar."""
    kept = 0
    with osmium.BackReferenceWriter(str(dst), ref_src=str(src), overwrite=True) as writer:
        processor = osmium.FileProcessor(str(src)).with_filter(
            osmium.filter.KeyFilter("historic", "tourism", "amenity")
        )
        for obj in processor:
            if wanted(obj.tags):
                writer.add(obj)
                kept += 1
    return kept


def relation_members(path):
    """Iliskilerin geometri icin ihtiyac duydugu nokta ve yol kimlikleri."""
    node_ids, way_ids = set(), set()
    for rel in osmium.FileProcessor(str(path), osmium.osm.RELATION):
        if not wanted(rel.tags):
            continue
        for m in rel.members:
            if m.type == "n":
                node_ids.add(m.ref)
            elif m.type == "w":
                way_ids.add(m.ref)
    return node_ids, way_ids


def bbox_extend(box, lat, lon):
    if box is None:
        return [lat, lon, lat, lon]
    box[0] = min(box[0], lat)
    box[1] = min(box[1], lon)
    box[2] = max(box[2], lat)
    box[3] = max(box[3], lon)
    return box


def bbox_merge(box, other):
    if other is None:
        return box
    if box is None:
        return list(other)
    return [min(box[0], other[0]), min(box[1], other[1]), max(box[2], other[2]), max(box[3], other[3])]


def slim_tags(tags):
    return {t.k: t.v for t in tags if t.k in KEEP_TAGS}


def collect_elements(path):
    """Overpass "out center" bicimiyle ayni merkezleri hesaplar."""
    rel_nodes, rel_ways = relation_members(path)
    node_pos, way_box = {}, {}
    elements = []

    def add(kind, osm_id, lat, lon, tags):
        elements.append((kind, osm_id, round(lat, COORD_DIGITS), round(lon, COORD_DIGITS), slim_tags(tags)))

    for obj in osmium.FileProcessor(str(path)).with_locations():
        if obj.is_node():
            if not obj.location.valid():
                continue
            if obj.id in rel_nodes:
                node_pos[obj.id] = (obj.location.lat, obj.location.lon)
            if wanted(obj.tags):
                add("n", obj.id, obj.location.lat, obj.location.lon, obj.tags)
        elif obj.is_way():
            box = None
            for nd in obj.nodes:
                if nd.location.valid():
                    box = bbox_extend(box, nd.location.lat, nd.location.lon)
            if box is None:
                continue
            if obj.id in rel_ways:
                way_box[obj.id] = box
            if wanted(obj.tags):
                add("w", obj.id, (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, obj.tags)
        elif obj.is_relation():
            if not wanted(obj.tags):
                continue
            box = None
            for m in obj.members:
                if m.type == "n" and m.ref in node_pos:
                    box = bbox_extend(box, *node_pos[m.ref])
                elif m.type == "w":
                    box = bbox_merge(box, way_box.get(m.ref))
            if box is None:
                continue
            add("r", obj.id, (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, obj.tags)
    return elements


def cell_key(lat, lon):
    return f"{math.floor(lat / CELL_SIZE)}_{math.floor(lon / CELL_SIZE)}"


def write_cells(elements, out_dir, osm_timestamp):
    layers = {"core": {}, "worship": {}}
    for el in elements:
        tags = el[4]
        layer = "core" if is_core(tags) else "worship"
        layers[layer].setdefault(cell_key(el[2], el[3]), []).append(list(el))

    for layer in layers:
        shutil.rmtree(out_dir / layer, ignore_errors=True)
        (out_dir / layer).mkdir(parents=True)

    cells = {}
    for idx, (layer, by_cell) in enumerate(layers.items()):
        for key, rows in by_cell.items():
            rows.sort(key=lambda r: (r[0], r[1]))  # kararli cikti: haftalik farklar kucuk kalsin
            with open(out_dir / layer / f"{key}.json", "w", encoding="utf-8") as fh:
                json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))
            cells.setdefault(key, [0, 0])[idx] = len(rows)

    index = {
        "version": FORMAT_VERSION,
        "cellSize": CELL_SIZE,
        "layers": list(layers),
        "osmTimestamp": osm_timestamp,
        "source": "© OpenStreetMap katkıcıları (ODbL), Geofabrik Türkiye özeti",
        "counts": {layer: sum(len(r) for r in by_cell.values()) for layer, by_cell in layers.items()},
        "cells": dict(sorted(cells.items())),
    }
    with open(out_dir / "index.json", "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    return index


def main():
    if len(sys.argv) != 3:
        sys.exit("kullanim: build_poi_data.py <turkey.osm.pbf> <cikti-klasoru>")
    src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    header = osmium.io.Reader(str(src), osmium.osm.osm_entity_bits.NOTHING).header()
    osm_timestamp = header.get("osmosis_replication_timestamp", "")

    with tempfile.TemporaryDirectory() as tmp:
        small = Path(tmp) / "filtered.osm.pbf"
        kept = filter_extract(src, small)
        print(f"filtre: {kept} eslesen nesne")
        elements = collect_elements(small)

    index = write_cells(elements, out_dir, osm_timestamp)
    print(f"OSM zamani: {osm_timestamp or '?'}")
    print(f"core: {index['counts']['core']}  worship: {index['counts']['worship']}  hucre: {len(index['cells'])}")


if __name__ == "__main__":
    main()
