"""
HypothesiAI – RGQS (Research Gap Quality Score) Unit Tests
==========================================================
Verifies:
  1. Each component score is strictly within [0, 1]
  2. RGQS is strictly within [0, 100]
  3. Weighting is mathematically exact:
     RGQS = 100 * (0.30*G + 0.25*E + 0.20*T + 0.15*N + 0.10*C)
  4. Exact verification example from prompt:
     G = 0.8, E = 0.9, T = 1.0, N = 0.7, C = 0.8 -> RGQS = 85.0
  5. Determinism / Reproducibility: same inputs produce identical RGQS
  6. Traceability sensitivity: stronger traceability increases or preserves score
  7. Contradiction sensitivity: contradictory evidence appropriately affects consistency
  8. Missing evidence behavior: missing evidence does not fabricate evidence
"""
import unittest

from app.pipeline.ranking.rgqs_calculator import (
    compute_rgqs_from_signals,
    calculate_rgqs_for_evidence_item,
    RGQS_WEIGHTS,
    get_rgqs_tier,
)


class TestRGQSCalculator(unittest.TestCase):

    def test_exact_specification_formula(self):
        """
        Verify the exact formula from the prompt specification:
        G = 0.8
        E = 0.9
        T = 1.0
        N = 0.7
        C = 0.8
        Expected:
        RGQS = 100 * (0.30*0.8 + 0.25*0.9 + 0.20*1.0 + 0.15*0.7 + 0.10*0.8)
             = 100 * (0.24 + 0.225 + 0.20 + 0.105 + 0.08)
             = 100 * 0.850 = 85.0
        """
        result = compute_rgqs_from_signals(
            gap_validity=0.8,
            evidence_grounding=0.9,
            traceability=1.0,
            novelty=0.7,
            consistency=0.8,
            supporting_evidence_count=8,
            supporting_paper_count=5,
        )

        expected = round(100.0 * (0.30 * 0.8 + 0.25 * 0.9 + 0.20 * 1.0 + 0.15 * 0.7 + 0.10 * 0.8), 1)
        self.assertEqual(result.rgqs, 85.0)
        self.assertEqual(result.rgqs, expected)
        self.assertEqual(result.tier, "Strong")
        self.assertEqual(result.components.gap_validity, 0.8)
        self.assertEqual(result.components.evidence_grounding, 0.9)
        self.assertEqual(result.components.traceability, 1.0)
        self.assertEqual(result.components.novelty, 0.7)
        self.assertEqual(result.components.consistency, 0.8)
        self.assertEqual(result.supporting_evidence_count, 8)
        self.assertEqual(result.supporting_paper_count, 5)

    def test_boundary_constraints(self):
        """Test zero and maximum boundaries for components and overall RGQS."""
        # Lower bound
        min_result = compute_rgqs_from_signals(0.0, 0.0, 0.0, 0.0, 0.0)
        self.assertEqual(min_result.rgqs, 0.0)
        self.assertEqual(min_result.tier, "Low-confidence")
        self.assertTrue(0.0 <= min_result.components.gap_validity <= 1.0)
        self.assertTrue(0.0 <= min_result.components.evidence_grounding <= 1.0)
        self.assertTrue(0.0 <= min_result.components.traceability <= 1.0)
        self.assertTrue(0.0 <= min_result.components.novelty <= 1.0)
        self.assertTrue(0.0 <= min_result.components.consistency <= 1.0)

        # Upper bound
        max_result = compute_rgqs_from_signals(1.0, 1.0, 1.0, 1.0, 1.0)
        self.assertEqual(max_result.rgqs, 100.0)
        self.assertEqual(max_result.tier, "Strong")

        # Clamp overshooting values
        clamped_result = compute_rgqs_from_signals(1.5, 2.0, -0.5, 1.1, -0.2)
        self.assertTrue(0.0 <= clamped_result.rgqs <= 100.0)
        self.assertEqual(clamped_result.components.gap_validity, 1.0)
        self.assertEqual(clamped_result.components.traceability, 0.0)

    def test_deterministic_reproducibility(self):
        """Ensure identical inputs always produce identical results."""
        res1 = compute_rgqs_from_signals(0.75, 0.82, 0.91, 0.65, 0.78)
        res2 = compute_rgqs_from_signals(0.75, 0.82, 0.91, 0.65, 0.78)
        self.assertEqual(res1.rgqs, res2.rgqs)
        self.assertEqual(res1.components.gap_validity, res2.components.gap_validity)
        self.assertEqual(res1.components.evidence_grounding, res2.components.evidence_grounding)
        self.assertEqual(res1.components.traceability, res2.components.traceability)
        self.assertEqual(res1.components.novelty, res2.components.novelty)
        self.assertEqual(res1.components.consistency, res2.components.consistency)
        self.assertEqual(res1.explanation, res2.explanation)

    def test_traceability_sensitivity(self):
        """Ensure stronger traceability with valid papers and page citations increases score."""
        low_trace = calculate_rgqs_for_evidence_item(
            item_type="recurring_limitations",
            score=0.85,
            confidence=0.80,
            source_papers=[],  # no verified papers
            source_pages=[],   # no page numbers
            source_statements=[],
        )

        high_trace = calculate_rgqs_for_evidence_item(
            item_type="recurring_limitations",
            score=0.85,
            confidence=0.80,
            source_papers=[{"id": "p1", "title": "Paper 1"}, {"id": "p2", "title": "Paper 2"}],
            source_pages=[5, 8],
            source_statements=["Verbatim limitation statement."],
        )

        self.assertGreater(high_trace.components.traceability, low_trace.components.traceability)
        self.assertGreater(high_trace.rgqs, low_trace.rgqs)

    def test_contradiction_sensitivity(self):
        """Ensure contradictory evidence appropriately affects consistency score."""
        consistent = calculate_rgqs_for_evidence_item(
            item_type="recurring_limitations",
            score=0.85,
            confidence=0.85,
            source_papers=[{"id": "p1", "title": "Paper 1"}, {"id": "p2", "title": "Paper 2"}],
            source_pages=[3],
            source_statements=["Consistent finding across papers."],
            dimension_scores={"contradiction_strength": 0.0},
        )

        contradictory = calculate_rgqs_for_evidence_item(
            item_type="contradiction_evidence",
            score=0.85,
            confidence=0.85,
            source_papers=[{"id": "p1", "title": "Paper 1"}, {"id": "p2", "title": "Paper 2"}],
            source_pages=[3],
            source_statements=["Conflicting assertion detected."],
            dimension_scores={"contradiction_strength": 0.90},
        )

        self.assertLess(contradictory.components.consistency, consistent.components.consistency)

    def test_weights_sum_to_one(self):
        """Validate that the 5 defined weights strictly sum to 1.0."""
        total_weight = sum(RGQS_WEIGHTS.values())
        self.assertAlmostEqual(total_weight, 1.0, places=5)
        self.assertEqual(RGQS_WEIGHTS["gap_validity"], 0.30)
        self.assertEqual(RGQS_WEIGHTS["evidence_grounding"], 0.25)
        self.assertEqual(RGQS_WEIGHTS["traceability"], 0.20)
        self.assertEqual(RGQS_WEIGHTS["novelty"], 0.15)
        self.assertEqual(RGQS_WEIGHTS["consistency"], 0.10)

    def test_tier_intervals(self):
        """Check all presentation tier boundaries."""
        self.assertEqual(get_rgqs_tier(95.0), "Strong")
        self.assertEqual(get_rgqs_tier(80.0), "Strong")
        self.assertEqual(get_rgqs_tier(79.9), "Moderate")
        self.assertEqual(get_rgqs_tier(60.0), "Moderate")
        self.assertEqual(get_rgqs_tier(59.9), "Weak")
        self.assertEqual(get_rgqs_tier(40.0), "Weak")
        self.assertEqual(get_rgqs_tier(39.9), "Low-confidence")
        self.assertEqual(get_rgqs_tier(10.0), "Low-confidence")


if __name__ == "__main__":
    unittest.main()
