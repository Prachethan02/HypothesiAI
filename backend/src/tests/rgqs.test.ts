import { GapRankingService } from '../services/gapRanking.service';


type TestResult = { name: string; passed: boolean; detail: string };
const results: TestResult[] = [];

function assert(name: string, condition: boolean, detail: string) {
  results.push({ name, passed: condition, detail });
  if (!condition) {
    console.error(`  ✗ FAIL: ${name}\n    ${detail}`);
  } else {
    console.log(`  ✓ PASS: ${name}`);
  }
}

function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RGQS Regression Test Suite (5 Scientific Fixes)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 1: Basic structural invariants
  // ────────────────────────────────────────────────────────────────────────────
  console.log('Group 1: Structural Invariants');

  const baseGap = {
    source_papers: [{ id: 'p1', title: 'Paper 1' }],
    source_statements: ['This method lacks generalization across clinical domains.'],
    source_pages: [5],
    evidence_type: 'recurring_limitations',
  };

  const r1 = GapRankingService.computeRGQS(baseGap);

  assert('RGQS in [0,100]', r1.rgqs >= 0 && r1.rgqs <= 100, `RGQS=${r1.rgqs}`);
  assert('All components in [0,1]',
    Object.values(r1.components).every(v => v >= 0 && v <= 1),
    JSON.stringify(r1.components));
  assert('Weights sum to 1.0',
    Math.abs(Object.values(r1.weights).reduce((a, b) => a + b, 0) - 1.0) < 0.001,
    `Sum=${Object.values(r1.weights).reduce((a, b) => a + b, 0)}`);
  assert('RGQS is deterministic',
    GapRankingService.computeRGQS(baseGap).rgqs === r1.rgqs,
    `Second run: ${GapRankingService.computeRGQS(baseGap).rgqs}`);
  assert('Tier is one of the 4 valid values',
    ['Strong', 'Moderate', 'Weak', 'Low-confidence'].includes(r1.tier),
    `Tier: ${r1.tier}`);
  assert('scoring_notes is an array',
    Array.isArray(r1.scoring_notes) && r1.scoring_notes!.length > 0,
    `Notes count: ${r1.scoring_notes?.length}`);
  assert('evidence_quality is populated',
    r1.evidence_quality != null && typeof r1.evidence_quality.unique_papers === 'number',
    JSON.stringify(r1.evidence_quality));

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 2: Fix-1 — Unique paper dedup + diminishing returns
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\nGroup 2: Fix-1 — Unique Paper Dedup + Diminishing Returns (G)');

  const oneSource = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }],
    source_statements: Array(10).fill('This method lacks scalability under large cohorts.'),
    source_pages: [1],
    evidence_type: 'recurring_limitations',
  });

  const fiveSource = GapRankingService.computeRGQS({
    source_papers: [
      { id: 'p1', title: 'Paper 1' }, { id: 'p2', title: 'Paper 2' },
      { id: 'p3', title: 'Paper 3' }, { id: 'p4', title: 'Paper 4' },
      { id: 'p5', title: 'Paper 5' },
    ],
    source_statements: Array(5).fill('This method lacks scalability under large cohorts.'),
    source_pages: [1, 2, 3, 4, 5],
    evidence_type: 'recurring_limitations',
  });

  assert('Fix-1: 5 unique papers G > 1 paper × 10 snippets G',
    fiveSource.components.gapValidity > oneSource.components.gapValidity,
    `G(5 papers)=${fiveSource.components.gapValidity.toFixed(3)} > G(1 paper)=${oneSource.components.gapValidity.toFixed(3)}`);

  const twoPapers = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }, { id: 'p2', title: 'Paper 2' }],
    source_statements: ['Limitation sentence from paper 2.'],
    evidence_type: 'recurring_limitations',
  });
  const tenPapers = GapRankingService.computeRGQS({
    source_papers: Array(10).fill(0).map((_, i) => ({ id: `p${i}`, title: `Paper ${i}` })),
    source_statements: ['Limitation sentence from multiple papers.'],
    evidence_type: 'recurring_limitations',
  });

  const gIncreaseRatio = (tenPapers.components.gapValidity - twoPapers.components.gapValidity) /
                          twoPapers.components.gapValidity;
  assert('Fix-1: Diminishing returns — G does not linearly scale with paper count',
    gIncreaseRatio < 0.5,
    `G ratio increase going from 2→10 papers: ${(gIncreaseRatio * 100).toFixed(1)}% (should be <50%)`);

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 3: Fix-2 — No circular composite_score in E
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\nGroup 3: Fix-2 — Evidence Grounding not Circular (E)');

  const noStatements = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }],
    source_statements: [],
    source_pages: [],
    composite_score: 0.99,
    confidence: 0.99,
    evidence_type: 'recurring_limitations',
  });

  const withStatements = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }],
    source_statements: ['This method has a significant limitation in sample diversity.'],
    source_pages: [3],
    composite_score: 0.99,
    confidence: 0.99,
    evidence_type: 'recurring_limitations',
  });

  assert('Fix-2: Gap with verbatim statements has higher E than no statements',
    withStatements.components.evidenceGrounding > noStatements.components.evidenceGrounding,
    `E(with stmts)=${withStatements.components.evidenceGrounding.toFixed(3)} > E(no stmts)=${noStatements.components.evidenceGrounding.toFixed(3)}`);

  assert('Fix-2: High composite_score alone does not give E > 0.50 when no statements',
    noStatements.components.evidenceGrounding < 0.50,
    `E(no stmts, composite_score=0.99)=${noStatements.components.evidenceGrounding.toFixed(3)} should be <0.50`);

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 4: Fix-3 — No free 0.5 default for missing pages
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\nGroup 4: Fix-3 — Traceability without Free Page Default (T)');

  const withPages = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }],
    source_statements: ['Method exhibits degraded performance under distribution shift.'],
    source_pages: [7, 12],
    evidence_type: 'recurring_limitations',
  });

  const withoutPages = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }],
    source_statements: ['Method exhibits degraded performance under distribution shift.'],
    source_pages: [],
    evidence_type: 'recurring_limitations',
  });

  assert('Fix-3: T with page provenance > T without pages',
    withPages.components.traceability > withoutPages.components.traceability,
    `T(pages)=${withPages.components.traceability.toFixed(3)} > T(no pages)=${withoutPages.components.traceability.toFixed(3)}`);

  const noProvenanceAtAll = GapRankingService.computeRGQS({
    source_papers: [],
    source_statements: [],
    source_pages: [],
    evidence_type: 'recurring_limitations',
  });

  assert('Fix-3: Zero provenance yields T < 0.30 (no free credit)',
    noProvenanceAtAll.components.traceability < 0.30,
    `T(no provenance)=${noProvenanceAtAll.components.traceability.toFixed(3)} should be < 0.30`);

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 5: Fix-4 — No hardcoded N >= 0.70 floor
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\nGroup 5: Fix-4 — Novelty Floor Removed (N)');

  const highCoverageGap = GapRankingService.computeRGQS({
    source_papers: Array(10).fill(0).map((_, i) => ({ id: `p${i}`, title: `Paper ${i}` })),
    source_statements: ['Performance degrades under domain shift.'],
    source_pages: [1],
    evidence_type: 'recurring_limitations',
    corpus_paper_count: 10,
    topic_coverage_fraction: 0.95,
  });

  const lowCoverageGap = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }],
    source_statements: ['Memory bandwidth bottleneck in 3D volumetric scan processing is underexplored.'],
    source_pages: [3],
    evidence_type: 'recurring_limitations',
    corpus_paper_count: 15,
    topic_coverage_fraction: 0.05,
  });

  assert('Fix-4: High corpus coverage → lower N than low coverage',
    lowCoverageGap.components.novelty > highCoverageGap.components.novelty,
    `N(5% coverage)=${lowCoverageGap.components.novelty.toFixed(3)} > N(95% coverage)=${highCoverageGap.components.novelty.toFixed(3)}`);

  assert('Fix-4: Novelty can fall below 0.30 for highly covered topics',
    highCoverageGap.components.novelty < 0.30,
    `N(95% coverage)=${highCoverageGap.components.novelty.toFixed(3)} should be < 0.30`);

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 6: Fix-5 — No free 0.80 default for consistency
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\nGroup 6: Fix-5 — Consistency Requires Agreement, Not Default 0.80 (C)');

  const singleSource = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }],
    source_statements: ['This model fails on rare disease cohorts.'],
    source_pages: [5],
    evidence_type: 'recurring_limitations',
  });

  const multiSource = GapRankingService.computeRGQS({
    source_papers: [
      { id: 'p1', title: 'Paper 1' }, { id: 'p2', title: 'Paper 2' },
      { id: 'p3', title: 'Paper 3' },
    ],
    source_statements: [
      'This model fails on rare disease cohorts.',
      'We observe consistent degradation across minority subgroups.',
      'Our results confirm poor generalization on underrepresented populations.',
    ],
    source_pages: [5, 8, 12],
    evidence_type: 'recurring_limitations',
  });

  assert('Fix-5: Multi-paper agreement yields higher C than single source',
    multiSource.components.consistency > singleSource.components.consistency,
    `C(3 papers)=${multiSource.components.consistency.toFixed(3)} > C(1 paper)=${singleSource.components.consistency.toFixed(3)}`);

  assert('Fix-5: Single source C < 0.50 (not free 0.80 default)',
    singleSource.components.consistency < 0.50,
    `C(single source)=${singleSource.components.consistency.toFixed(3)} should be < 0.50`);

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 7: Contradiction handling
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\nGroup 7: Contradiction Handling');

  const typeA = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }, { id: 'p2', title: 'Paper 2' }],
    source_statements: ['Method is effective', 'Method is ineffective in clinical settings'],
    evidence_type: 'recurring_limitations',
    dimensions: [{ name: 'Contradiction Strength', raw_score: 0.75 }],
  });

  const typeB = GapRankingService.computeRGQS({
    source_papers: [{ id: 'p1', title: 'Paper 1' }, { id: 'p2', title: 'Paper 2' }],
    source_statements: ['Residual connections show no benefit for small-organ segmentation'],
    evidence_type: 'contradiction_evidence',
    dimensions: [{ name: 'Contradiction Strength', raw_score: 0.85 }],
  });

  assert('Contradiction Type B has C >= 0.35 (contradiction IS the gap)',
    typeB.components.consistency >= 0.35,
    `C(Type B)=${typeB.components.consistency.toFixed(3)}`);

  assert('Contradiction Type A has lower C than Type B (contradiction weakens the gap)',
    typeA.components.consistency < typeB.components.consistency,
    `C(TypeA)=${typeA.components.consistency.toFixed(3)} < C(TypeB)=${typeB.components.consistency.toFixed(3)}`);

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 8: Edge cases
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\nGroup 8: Edge Cases');

  const emptyGap = GapRankingService.computeRGQS({});
  assert('Empty gap does not crash and RGQS in [0,100]',
    emptyGap.rgqs >= 0 && emptyGap.rgqs <= 100,
    `RGQS=${emptyGap.rgqs}`);
  assert('Empty gap has RGQS < 30 (sparse evidence correctly penalised)',
    emptyGap.rgqs < 30,
    `RGQS(empty)=${emptyGap.rgqs.toFixed(1)}`);

  const perfectGap = GapRankingService.computeRGQS({
    source_papers: Array(8).fill(0).map((_, i) => ({ id: `p${i}`, title: `Paper ${i}` })),
    source_statements: Array(8).fill(0).map((_, i) =>
      `Paper ${i} documents a significant limitation in clinical generalization under distribution shift.`),
    source_pages: [1, 2, 3, 4, 5, 6, 7, 8],
    evidence_type: 'recurring_limitations',
    corpus_paper_count: 15,
    topic_coverage_fraction: 0.10,
    limitation_statement_count: 8,
  });

  assert('Well-evidenced gap yields RGQS in Strong tier (>= 65)',
    perfectGap.rgqs >= 65,
    `RGQS(perfect)=${perfectGap.rgqs.toFixed(1)}`);

  // ────────────────────────────────────────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`  Results: ${passed}/${total} tests passed`);
  if (passed === total) {
    console.log('  ✓ ALL 18 VERIFICATION CHECKS PASSED');
  } else {
    const failed = results.filter(r => !r.passed);
    console.log(`\n  FAILED TESTS:`);
    for (const f of failed) {
      console.log(`    ✗ ${f.name}: ${f.detail}`);
    }
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  return passed === total;
}

const success = runTests();
process.exit(success ? 0 : 1);
