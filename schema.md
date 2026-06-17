# Industrial Standards Wiki Schema

## Page Types

### Standard Page (`wiki/standards/<type>-<code>-<year>.md`)

**Frontmatter:**
```yaml
type: standard
std_type: GB|GB/T|JB|JB/T|DB|DB/T|QB
std_code: "standard number"
std_year: year
title: "Standard Title"
equipment: [equipment-slug-list]
scope: "scope description"
replaces: [replaced-standard-slugs]
conflicts: [conflicting-standard-slugs]
related: [related-page-slugs]
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: ["source-filename.md"]
tags: [tag1, tag2]
status: active|withdrawn

source_detail:
  - chapter: "4"
    chapter_title: "Technical Requirements"
    sections: ["4.1", "4.2"]
    content_type: extracted|reorganized|generated
content_type: extracted|reorganized|generated|hybrid
```

**Content Structure:**
- Scope (from Chapter 1)
- Technical Requirements
- Relations (replaces, conflicts, references)
- Application Scenarios

### Equipment Page (`wiki/equipment/<equipment-slug>.md`)

**Frontmatter:**
```yaml
type: equipment
title: "Equipment Name"
category: equipment-category
standards: [related-standard-slugs]
parameters: [parameter-slugs]
applications: [application-areas]
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: ["source-filename.md"]
tags: [tags]
related: [related-equipment]
```

### Parameter Page (`wiki/parameters/<parameter-slug>.md`)

**Frontmatter:**
```yaml
type: parameter
title: "Parameter Name"
unit: "unit"
definition: "parameter definition"
standards: [related-standard-slugs]
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: ["source-filename.md"]
tags: [tags]
related: [related-parameters]
```

## Standard Types

| Type | Full Name | Level |
|------|-----------|-------|
| GB | 国家标准 | National |
| GB/T | 国家推荐标准 | National |
| JB | 机械行业标准 | Industry |
| JB/T | 机械行业推荐标准 | Industry |
| DB | 地方标准 | Provincial |
| DB/T | 地方推荐标准 | Provincial |
| QB | 企业标准 | Enterprise |

## Content Types

- **extracted**: Direct quote from source
- **reorganized**: Combined from multiple source sections
- **generated**: LLM understanding/synthesis
- **hybrid**: Mix of the above

## Source Tracking

Every page must include:
- `sources`: Array of source filenames
- `source_detail`: Chapter/section references with content types
- `content_type`: Overall content classification

In content, use format: `[Source: filename.md Chapter X, type]`
