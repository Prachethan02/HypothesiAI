import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getMigrationFiles } from '../src/db/migrator';
import { ALL_TABLE_NAMES } from '../src/db/types';

describe('Database Schema & Migration Validation', () => {
  const migrationFiles = getMigrationFiles();

  it('should find all sequential migration files', () => {
    expect(migrationFiles.length).toBeGreaterThanOrEqual(2);
    expect(migrationFiles[0].name).toBe('001_core_schema.sql');
    expect(migrationFiles[1].name).toBe('002_indexes_and_triggers.sql');
  });

  it('should declare all 15 required entities in 001_core_schema.sql', () => {
    const coreSchema = fs.readFileSync(migrationFiles[0].fullPath, 'utf8');

    ALL_TABLE_NAMES.forEach((tableName) => {
      const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\s*\\(`, 'i');
      expect(coreSchema).toMatch(tableRegex);
    });
    expect(ALL_TABLE_NAMES).toHaveLength(15);
  });

  it('should establish strict foreign key relations and provenance back to papers and sections', () => {
    const coreSchema = fs.readFileSync(migrationFiles[0].fullPath, 'utf8');

    // Traceability for sections
    expect(coreSchema).toContain('paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE');

    // Traceability for extracted entities back to paper and section
    expect(coreSchema).toContain('REFERENCES paper_sections(id) ON DELETE SET NULL');

    // Traceability for entity aliases
    expect(coreSchema).toContain('entity_id UUID NOT NULL REFERENCES extracted_entities(id) ON DELETE CASCADE');

    // Traceability for paper relationships
    expect(coreSchema).toContain('source_paper_id UUID NOT NULL REFERENCES papers(id)');
    expect(coreSchema).toContain('target_paper_id UUID NOT NULL REFERENCES papers(id)');

    // Traceability for contradictions back to paper and section
    expect(coreSchema).toContain('premise_paper_id UUID NOT NULL REFERENCES papers(id)');
    expect(coreSchema).toContain('hypothesis_paper_id UUID NOT NULL REFERENCES papers(id)');

    // Traceability for gap evidence back to gap, paper, and section
    expect(coreSchema).toContain('gap_id UUID NOT NULL REFERENCES research_gaps(id) ON DELETE CASCADE');
    expect(coreSchema).toContain('source_paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE');

    // Traceability for hypotheses back to gap
    expect(coreSchema).toContain('gap_id UUID NOT NULL REFERENCES research_gaps(id)');
  });

  it('should include status fields across core workflow entities', () => {
    const coreSchema = fs.readFileSync(migrationFiles[0].fullPath, 'utf8');

    expect(coreSchema).toContain("status VARCHAR(50) NOT NULL DEFAULT 'uploaded'"); // papers
    expect(coreSchema).toContain("status VARCHAR(50) DEFAULT 'unresolved'"); // contradictions
    expect(coreSchema).toContain("status VARCHAR(50) DEFAULT 'candidate'"); // research_gaps
    expect(coreSchema).toContain("status VARCHAR(50) DEFAULT 'generated'"); // hypotheses
    expect(coreSchema).toContain("status VARCHAR(50) NOT NULL DEFAULT 'started'"); // analysis_runs
  });

  it('should configure performance B-Tree, GIN, and trigger functions in 002_indexes_and_triggers.sql', () => {
    const indexMigration = fs.readFileSync(migrationFiles[1].fullPath, 'utf8');

    // Indexes
    expect(indexMigration).toContain('idx_papers_user_id');
    expect(indexMigration).toContain('idx_extracted_entities_norm_name');
    expect(indexMigration).toContain('idx_research_gaps_confidence');
    expect(indexMigration).toContain('idx_gap_evidence_source_paper');
    expect(indexMigration).toContain('idx_contradictions_prob');

    // GIN Indexes
    expect(indexMigration).toContain('USING GIN (authors)');
    expect(indexMigration).toContain('USING GIN (antecedent_entities)');
    expect(indexMigration).toContain('USING GIN (citations)');

    // Triggers
    expect(indexMigration).toContain('update_updated_at_column');
    expect(indexMigration).toContain('trg_papers_updated_at');
    expect(indexMigration).toContain('trg_research_gaps_updated_at');
    expect(indexMigration).toContain('trg_hypotheses_updated_at');
  });
});
