# Generator JSON format

Generator catalogs are stored by locale:

```text
data/generators/
├── en/
└── fr/
```

English is the reference locale. Every `.json` file in `en/` becomes a generator
category after `/reload` or a manual process restart, and `fr/` contains the corresponding localized
file. If a localized file is absent at runtime, the catalog falls back to its
English counterpart.

Both files must keep the same filename, object keys, entry ordering, array lengths,
weights, placeholders, and technical values. Translate only display text. In
particular, `Generator`, `Type`, and `Rarity` values, structured field keys, and
the English generator ID must remain unchanged. The loader derives that ID from
the English file and exposes the localized root `name` only as a display label.

```json
{
  "name": "weather",
  "description": "Weather conditions and complications",
  "entries": []
}
```

Entries support three formats.

## Simple text

```json
"A violent thunderstorm approaches."
```

Simple strings have a default weight of `1`.

## Weighted text

```json
{
  "weight": 3,
  "value": "A gentle rain begins."
}
```

## Structured fields

```json
{
  "weight": 2,
  "fields": {
    "Name": "Fire RULE",
    "Description": "Create and control nearby flames.",
    "Limitation": "The flames weaken with distance."
  }
}
```

`fields` may contain between 1 and 25 display fields. Text, number, and boolean
values are accepted.

`weight` is optional and defaults to `1`. A weight of `2` makes an entry twice as
likely to be selected as an entry with weight `1`; a weight of `10` makes it ten
times as likely. Weights must be positive numbers.

`services/generatorCatalog.js` provides `getGenerator(id, locale)`,
`generate(id, locale)`, and `listGenerators(locale)`. Catalogs are cached
independently per locale; there is intentionally no live reload.
