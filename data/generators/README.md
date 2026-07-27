# Generator JSON format

Every `.json` file in this directory becomes a generator category after the bot
restarts.

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
