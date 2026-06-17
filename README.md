# Industrial Standards Wiki

A knowledge management system for industrial standards with intelligent content extraction, semantic querying, and quality assurance capabilities.

## Overview

The Industrial Standards Wiki is designed to manage comprehensive knowledge about industrial standards including:

- **National Standards (GB/GB/T)**: Chinese national standards and recommendations
- **Industry Standards (JB/JB/T)**: Mechanical industry standards and recommendations  
- **Provincial Standards (DB/DB/T)**: Regional/provincial standards
- **Enterprise Standards (QB)**: Company-specific standards

The system uses LLM-powered analysis to extract structured knowledge from source documents, maintains relationships between standards, and provides semantic search capabilities.

## Features

### Content Ingestion
- **Two-Step LLM Chain**: Analysis phase for understanding document structure, followed by generation phase for creating wiki pages
- **Smart Caching**: File hash-based caching avoids reprocessing unchanged documents
- **Batch Processing**: Ingest multiple source files in parallel
- **Source Attribution**: Complete tracking of content sources with chapter/section references

### Knowledge Management
- **Three Page Types**:
  - **Standard Pages**: Complete standard documents with scope, requirements, and test methods
  - **Equipment Pages**: Technical specifications, applications, and related standards
  - **Parameter Pages**: Definitions, units, requirements by standard, and test methods

### Relations Management
- **Replaces**: Standard replacement relationships (full/partial)
- **Conflicts**: Technical contradictions between standards
- **References**: Cross-references between standards
- **Scope Overlap**: Overlapping application scopes

### Semantic Query
- **Natural Language Questions**: Ask questions and get AI-powered answers from the wiki
- **Keyword Search**: Find relevant pages using keyword matching
- **Interactive Mode**: Continuous query session for exploration
- **Relevance Scoring**: Results ranked by relevance with excerpts

### Quality Assurance
- **Five-Dimensional Quality Check**:
  1. **Structure Retention (20%)**: Preservation of document structure
  2. **Content Retention (25%)**: Coverage of original content
  3. **Parameter Completeness (20%)**: Extraction of technical parameters
  4. **Reference Completeness (20%)**: Source tracking and citations
  5. **Inspection Completeness (15%)**: Recency, validation, and consistency

## Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- Anthropic API key for LLM features

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd industrial-standards-wiki
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment:
```bash
# Create .env file with your Anthropic API key
echo "ANTHROPIC_API_KEY=your_api_key_here" > .env
```

4. Build the project:
```bash
npm run build
```

## Configuration

### Environment Variables
- `ANTHROPIC_API_KEY`: Required for LLM-powered ingestion and querying
- `ANTHROPIC_MODEL`: Optional, defaults to `claude-3-opus-20240229`

### Project Structure
```
industrial-standards-wiki/
├── src/                      # Source code
│   ├── core/                 # Core functionality (ingest, relations)
│   ├── integrity/            # Quality checking
│   ├── lib/                  # Shared utilities
│   ├── parser/               # File parsing utilities
│   ├── prompts/              # LLM prompts
│   ├── query/                # Query engine
│   └── types/                # TypeScript type definitions
├── scripts/                  # CLI entry points
│   ├── ingest.ts             # Content ingestion
│   ├── query.ts              # Semantic querying
│   └── check-integrity.ts    # Quality checking
├── wiki/                     # Wiki content storage
│   ├── standards/            # Standard pages
│   ├── equipment/           # Equipment pages
│   ├── parameters/           # Parameter pages
│   ├── index.md              # Wiki index
│   ├── relations.md          # Relations index
│   └── log.md                # Change log
├── sources/                  # Source documents for ingestion
├── purpose.md                # Project purpose documentation
├── schema.md                 # Wiki schema specification
├── package.json              # Project configuration
└── README.md                 # This file
```

## Usage

### Content Ingestion

Ingest a single source file:
```bash
npm run ingest sources/standard-document.md
```

Ingest multiple files:
```bash
npm run ingest sources/*.md
```

Force reprocessing (ignore cache):
```bash
npm run ingest -- -f sources/standard-document.md
```

Enable verbose logging:
```bash
npm run ingest -- -v sources/standard-document.md
```

### Semantic Querying

Ask a question:
```bash
npm run query ask "What are the technical requirements for industrial robots?"
```

Interactive query session:
```bash
npm run query interactive
```

Search without AI generation:
```bash
npm run query search "robot safety standards"
```

List all wiki pages:
```bash
npm run query list
```

List pages by type:
```bash
npm run query list --type standard
```

Get a specific page:
```bash
npm run query get standards/GB-T-1234-2023
```

Extract keywords from a query:
```bash
npm run query keywords "robot arm technical specifications"
```

### Quality Checking

Check integrity of a wiki page:
```bash
npm run check-integrity wiki/standards/GB-T-1234-2023.md
```

The integrity checker evaluates:
- Structure preservation (chapters, sections)
- Content coverage (character count, extraction type)
- Parameter completeness (type-specific fields)
- Reference tracking (sources, citations)
- Inspection metrics (recency, tags, related pages)

Results include:
- Overall score (0-100)
- Per-dimension scores with detailed feedback
- Letter grade (A-F)
- Pass/fail status (threshold: 70)

### Relations Management

Update relations index from all wiki pages:
```bash
npm run relations
```

Query relations for a specific page:
```bash
npm run relations get standards/GB-T-1234-2023
```

## Development

### Type Definitions

The project uses strict TypeScript typing defined in `src/types/index.ts`:

- `WikiPageFrontmatter`: Base fields for all pages
- `StandardFrontmatter`: Standard-specific fields
- `EquipmentFrontmatter`: Equipment-specific fields  
- `ParameterFrontmatter`: Parameter-specific fields
- `FileBlock`: Content block with source attribution
- `Relation`: Relationship between pages
- `IngestResult`: Result from ingestion process
- `QueryResult`: Result from semantic query
- `IntegrityResult`: Result from quality check

### Content Types

Content blocks are classified by origin:
- `extracted`: Direct quote from source
- `reorganized`: Combined from multiple source sections
- `generated`: LLM understanding/synthesis
- `hybrid`: Mix of the above

### Standard Types

| Type | Full Name | Level |
|------|-----------|-------|
| GB | 国家标准 | National |
| GB/T | 国家推荐标准 | National Recommended |
| JB | 机械行业标准 | Industry |
| JB/T | 机械行业推荐标准 | Industry Recommended |
| DB | 地方标准 | Provincial |
| DB/T | 地方推荐标准 | Provincial Recommended |
| QB | 企业标准 | Enterprise |

### Testing

Run tests:
```bash
npm test
```

### Building

Compile TypeScript:
```bash
npm run build
```

## Wiki Page Schema

### Standard Page Example

```yaml
---
type: standard
std_type: GB/T
std_code: "12345"
std_year: 2023
title: "Industrial Robot Safety Requirements"
equipment: [robot-arm, welding-robot]
scope: "Safety requirements for industrial robots in manufacturing"
replaces: [GB-12345-2010]
conflicts: []
related: [robot-sensor-guide]
created: 2023-01-15
updated: 2023-01-15
sources: ["source-document.md"]
tags: [robotics, safety, manufacturing]
status: active
source_detail:
  - chapter: "4"
    chapter_title: "Technical Requirements"
    sections: ["4.1", "4.2"]
    content_type: extracted
content_type: extracted
---
```

### Equipment Page Example

```yaml
---
type: equipment
title: "Industrial Robotic Arm"
category: "Robotics"
standards: [GB-T-12345-2023, JB-T-6789-2020]
parameters: [payload, reach, accuracy]
applications: [welding, assembly, painting]
created: 2023-01-15
updated: 2023-01-15
sources: ["equipment-specs.md"]
tags: [robotics, automation]
related: [welding-robot]
---
```

### Parameter Page Example

```yaml
---
type: parameter
title: "Maximum Payload"
unit: "kg"
definition: "Maximum weight the robot can safely manipulate"
standards: [GB-T-12345-2023]
created: 2023-01-15
updated: 2023-01-15
sources: ["parameters.md"]
tags: [specifications, performance]
related: [working-load, rated-load]
---
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please ensure:
- All code passes TypeScript compilation
- New features include tests
- Documentation is updated
- Code follows existing patterns

## Support

For issues, questions, or contributions, please use the project's issue tracker.
