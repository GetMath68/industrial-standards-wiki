/**
 * Tests for YAML frontmatter parser
 */

import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  parseFrontmatterArray,
  setFrontmatterScalar,
  setFrontmatterArray,
  createFrontmatter,
  validateFrontmatter
} from '../../src/parser/frontmatter.js';
import type { WikiPageFrontmatter, StandardFrontmatter } from '../../src/types/index.js';

describe('parseFrontmatter', () => {
  it('should parse valid frontmatter with remaining content', () => {
    const input = `---
type: standard
title: Test Standard
created: 2023-01-01
updated: 2023-01-01
sources: []
tags: []
---

# Content here`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).not.toBeNull();
    expect(result.frontmatter?.title).toBe('Test Standard');
    expect(result.content).toBe('# Content here');
    expect(result.error).toBeUndefined();
  });

  it('should return null frontmatter for content without frontmatter', () => {
    const input = `# Just markdown content
No frontmatter here.`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).toBeNull();
    expect(result.content).toBe(input);
    expect(result.error).toBeUndefined();
  });

  it('should handle unclosed frontmatter', () => {
    const input = `---
type: standard
title: Test
created: 2023-01-01
updated: 2023-01-01
sources: []
tags: []

# Content without closing delimiter`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).toBeNull();
    expect(result.error).toBe('Frontmatter not properly closed');
  });

  it('should validate required fields', () => {
    const input = `---
title: Missing required fields
---

# Content`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).toBeNull();
    expect(result.error).toContain('Missing required fields');
  });

  it('should parse standard frontmatter with all fields', () => {
    const input = `---
type: standard
title: GB/T 1234-2023
created: 2023-01-01
updated: 2023-06-15
sources:
  - source1.pdf
  - source2.pdf
tags:
  - safety
  - equipment
std_type: GB/T
std_code: 1234
std_year: 2023
equipment:
  - pump
  - valve
scope: Technical requirements
---

# Standard content`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).not.toBeNull();
    const fm = result.frontmatter as StandardFrontmatter;
    expect(fm.type).toBe('standard');
    expect(fm.title).toBe('GB/T 1234-2023');
    expect(fm.sources).toHaveLength(2);
    expect(fm.std_type).toBe('GB/T');
    expect(fm.std_code).toBe(1234);
    expect(fm.std_year).toBe(2023);
  });

  it('should parse equipment frontmatter', () => {
    const input = `---
type: equipment
title: Centrifugal Pump
created: 2023-01-01
updated: 2023-06-15
sources: []
tags:
  - equipment
  - rotating
category: Pumps
standards:
  - GB/T 1234-2023
parameters:
  - flow-rate
  - head
applications:
  - water supply
  - irrigation
---

# Equipment content`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).not.toBeNull();
    expect(result.frontmatter?.type).toBe('equipment');
    expect(result.frontmatter?.category).toBe('Pumps');
  });

  it('should parse parameter frontmatter', () => {
    const input = `---
type: parameter
title: Flow Rate
created: 2023-01-01
updated: 2023-06-15
sources: []
tags:
  - parameter
  - performance
unit: m³/h
definition: Volume of liquid flowing per unit time
standards:
  - GB/T 1234-2023
---

# Parameter content`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).not.toBeNull();
    expect(result.frontmatter?.type).toBe('parameter');
    expect(result.frontmatter?.unit).toBe('m³/h');
  });

  it('should handle frontmatter with related pages', () => {
    const input = `---
type: standard
title: Test Standard
created: 2023-01-01
updated: 2023-01-01
sources: []
tags: []
related:
  - equipment/pump
  - parameter/flow-rate
---

# Content`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter?.related).toEqual(['equipment/pump', 'parameter/flow-rate']);
  });

  it('should handle YAML syntax errors', () => {
    const input = `---
type: standard
title: Test
created: "unclosed string
updated: 2023-01-01
sources: []
tags: []
---

# Content`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('should normalize Windows line endings', () => {
    const input = '---\r\ntype: standard\r\ntitle: Test\r\ncreated: 2023-01-01\r\nupdated: 2023-01-01\r\nsources: []\r\ntags: []\r\n---\r\n\r\n# Content';

    const result = parseFrontmatter(input);

    expect(result.frontmatter).not.toBeNull();
    expect(result.content).toBe('# Content');
  });

  it('should handle empty frontmatter object', () => {
    const input = `---
type: standard
title: Test
created: 2023-01-01
updated: 2023-01-01
sources: []
tags: []
---

`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter).not.toBeNull();
    expect(result.content).toBe('');
  });

  it('should handle complex YAML values', () => {
    const input = `---
type: standard
title: Test Standard
created: 2023-01-01
updated: 2023-06-15
sources: []
tags: []
replaces:
  - old-standard-1
  - old-standard-2
conflicts:
  - conflicting-standard
---

# Content`;

    const result = parseFrontmatter(input);

    expect(result.frontmatter?.replaces).toEqual(['old-standard-1', 'old-standard-2']);
    expect(result.frontmatter?.conflicts).toEqual(['conflicting-standard']);
  });
});

describe('parseFrontmatterArray', () => {
  it('should parse string array from frontmatter', () => {
    const fm = `---
sources:
  - source1.pdf
  - source2.pdf
  - source3.pdf
`;

    const result = parseFrontmatterArray(fm, 'sources');

    expect(result).toEqual(['source1.pdf', 'source2.pdf', 'source3.pdf']);
  });

  it('should return empty array for missing field', () => {
    const fm = `---
title: Test
`;

    const result = parseFrontmatterArray(fm, 'sources');

    expect(result).toEqual([]);
  });

  it('should convert single string to array', () => {
    const fm = `---
sources: single-source.pdf
`;

    const result = parseFrontmatterArray(fm, 'sources');

    expect(result).toEqual(['single-source.pdf']);
  });

  it('should return null for non-array non-string values', () => {
    const fm = `---
sources: 123
`;

    const result = parseFrontmatterArray(fm, 'sources');

    expect(result).toBeNull();
  });

  it('should handle empty array', () => {
    const fm = `---
sources: []
`;

    const result = parseFrontmatterArray(fm, 'sources');

    expect(result).toEqual([]);
  });

  it('should handle nested arrays', () => {
    const fm = `---
tags:
  - safety
  - equipment
  - mandatory
`;

    const result = parseFrontmatterArray(fm, 'tags');

    expect(result).toEqual(['safety', 'equipment', 'mandatory']);
  });

  it('should return null for invalid YAML', () => {
    const fm = `---
invalid: yaml: content:
`;

    const result = parseFrontmatterArray(fm, 'sources');

    expect(result).toBeNull();
  });

  it('should handle array with special characters', () => {
    const fm = `---
sources:
  - GB/T 1234-2023.pdf
  - JB/T 5678-2022.pdf
  - 设备标准.pdf
`;

    const result = parseFrontmatterArray(fm, 'sources');

    expect(result).toHaveLength(3);
    expect(result).toContain('GB/T 1234-2023.pdf');
    expect(result).toContain('设备标准.pdf');
  });
});

describe('setFrontmatterScalar', () => {
  it('should set string value in frontmatter', () => {
    const fm = `---
title: Old Title
updated: 2023-01-01
`;

    const result = setFrontmatterScalar(fm, 'title', 'New Title');

    expect(result).toContain('title: New Title');
    expect(result).toContain('updated: 2023-01-01');
  });

  it('should set number value in frontmatter', () => {
    const fm = `---
year: 2020
`;

    const result = setFrontmatterScalar(fm, 'year', 2023);

    expect(result).toContain('year: 2023');
  });

  it('should set boolean value in frontmatter', () => {
    const fm = `---
active: false
`;

    const result = setFrontmatterScalar(fm, 'active', true);

    expect(result).toContain('active: true');
  });

  it('should add new field if not exists', () => {
    const fm = `---
title: Test
`;

    const result = setFrontmatterScalar(fm, 'status', 'active');

    expect(result).toContain('status: active');
    expect(result).toContain('title: Test');
  });

  it('should return original for invalid YAML', () => {
    const fm = `invalid yaml content`;

    const result = setFrontmatterScalar(fm, 'title', 'New');

    expect(result).toBe(fm);
  });

  it('should set null value', () => {
    const fm = `---
title: Test
`;

    const result = setFrontmatterScalar(fm, 'title', null);

    expect(result).toContain('title: null');
  });
});

describe('setFrontmatterArray', () => {
  it('should set array values in frontmatter', () => {
    const fm = `---
sources:
  - old1.pdf
  - old2.pdf
`;

    const result = setFrontmatterArray(fm, 'sources', ['new1.pdf', 'new2.pdf', 'new3.pdf']);

    expect(result).toContain('sources:');
    expect(result).toContain('- new1.pdf');
    expect(result).toContain('- new2.pdf');
    expect(result).toContain('- new3.pdf');
  });

  it('should add new array field', () => {
    const fm = `---
title: Test
`;

    const result = setFrontmatterArray(fm, 'tags', ['safety', 'equipment']);

    expect(result).toContain('tags:');
    expect(result).toContain('- safety');
    expect(result).toContain('- equipment');
  });

  it('should remove field when setting empty array', () => {
    const fm = `---
title: Test
sources:
  - source1.pdf
`;

    const result = setFrontmatterArray(fm, 'sources', []);

    expect(result).not.toContain('sources:');
    expect(result).toContain('title: Test');
  });

  it('should handle single element array', () => {
    const fm = `---
title: Test
`;

    const result = setFrontmatterArray(fm, 'sources', ['only.pdf']);

    expect(result).toContain('sources:');
    expect(result).toContain('- only.pdf');
  });

  it('should return original for invalid YAML', () => {
    const fm = `invalid: yaml: content`;

    const result = setFrontmatterArray(fm, 'sources', ['new.pdf']);

    expect(result).toBe(fm);
  });

  it('should preserve other fields when updating array', () => {
    const fm = `---
title: Test Standard
type: standard
sources:
  - old.pdf
updated: 2023-01-01
`;

    const result = setFrontmatterArray(fm, 'sources', ['new.pdf']);

    expect(result).toContain('title: Test Standard');
    expect(result).toContain('type: standard');
    expect(result).toContain('updated: 2023-01-01');
    expect(result).toContain('- new.pdf');
  });
});

describe('createFrontmatter', () => {
  it('should create YAML frontmatter from object', () => {
    const fm: WikiPageFrontmatter = {
      type: 'standard',
      title: 'Test Standard',
      created: '2023-01-01',
      updated: '2023-06-15',
      sources: ['source1.pdf'],
      tags: ['safety']
    };

    const result = createFrontmatter(fm);

    expect(result).toContain('type: standard');
    expect(result).toContain('title: Test Standard');
    expect(result).toContain('created: 2023-01-01');
    expect(result).toContain('updated: 2023-06-15');
  });

  it('should handle complex frontmatter object', () => {
    const fm: StandardFrontmatter = {
      type: 'standard',
      title: 'GB/T 1234-2023',
      created: '2023-01-01',
      updated: '2023-06-15',
      sources: ['GB.pdf'],
      tags: ['safety', 'mandatory'],
      std_type: 'GB/T',
      std_code: '1234',
      std_year: 2023,
      equipment: ['pump', 'valve'],
      scope: 'Technical requirements'
    };

    const result = createFrontmatter(fm);

    expect(result).toContain('std_type: GB/T');
    expect(result).toContain('std_code: "1234"');
    expect(result).toContain('std_year: 2023');
  });
});

describe('validateFrontmatter', () => {
  it('should validate correct frontmatter', () => {
    const fm: WikiPageFrontmatter = {
      type: 'standard',
      title: 'Test',
      created: '2023-01-01',
      updated: '2023-01-01',
      sources: [],
      tags: []
    };

    const result = validateFrontmatter(fm);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required fields', () => {
    const fm = {
      title: 'Test'
    };

    const result = validateFrontmatter(fm);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('type'))).toBe(true);
  });

  it('should detect invalid page type', () => {
    const fm = {
      type: 'invalid_type',
      title: 'Test',
      created: '2023-01-01',
      updated: '2023-01-01',
      sources: [],
      tags: []
    };

    const result = validateFrontmatter(fm);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid page type'))).toBe(true);
  });

  it('should detect non-array sources field', () => {
    const fm = {
      type: 'standard',
      title: 'Test',
      created: '2023-01-01',
      updated: '2023-01-01',
      sources: 'not-an-array',
      tags: []
    };

    const result = validateFrontmatter(fm);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sources must be an array'))).toBe(true);
  });

  it('should detect non-array tags field', () => {
    const fm = {
      type: 'standard',
      title: 'Test',
      created: '2023-01-01',
      updated: '2023-01-01',
      sources: [],
      tags: 'not-an-array'
    };

    const result = validateFrontmatter(fm);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('tags must be an array'))).toBe(true);
  });

  it('should detect non-array related field', () => {
    const fm = {
      type: 'standard',
      title: 'Test',
      created: '2023-01-01',
      updated: '2023-01-01',
      sources: [],
      tags: [],
      related: 'not-an-array'
    };

    const result = validateFrontmatter(fm);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('related must be an array'))).toBe(true);
  });

  it('should handle null input', () => {
    const result = validateFrontmatter(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Frontmatter must be an object');
  });

  it('should accept all valid page types', () => {
    const types = ['standard', 'equipment', 'parameter'];

    types.forEach(type => {
      const fm = {
        type,
        title: 'Test',
        created: '2023-01-01',
        updated: '2023-01-01',
        sources: [],
        tags: []
      };

      const result = validateFrontmatter(fm);
      expect(result.valid).toBe(true);
    });
  });

  it('should allow optional related field when valid array', () => {
    const fm = {
      type: 'standard',
      title: 'Test',
      created: '2023-01-01',
      updated: '2023-01-01',
      sources: [],
      tags: [],
      related: ['page1', 'page2']
    };

    const result = validateFrontmatter(fm);

    expect(result.valid).toBe(true);
  });
});
