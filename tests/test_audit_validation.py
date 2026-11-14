import copy
import unittest

from intelligence.audit_validation import validate_audit
from intelligence.point_in_time import assess_asof


class AuditValidationTests(unittest.TestCase):
    def setUp(self):
        self.panel = {"schema": "amalgam.cross-domain-observation-panel.v1",
                      "observations": [{"date": "2025-01-02", "wti_usd_per_barrel": 70,
                                        "brent_usd_per_barrel": 75, "treasury_10y_percent": 4.4},
                                       {"date": "2025-01-03", "wti_usd_per_barrel": 71,
                                        "brent_usd_per_barrel": 76, "treasury_10y_percent": 4.5}]}
        self.audit = assess_asof(self.panel, "2026-11-04T00:00:00Z")

    def test_matching_audit(self):
        result = validate_audit(self.panel, self.audit)
        self.assertEqual(result["status"], "verified_internal_consistency")
        self.assertEqual(result["observations"], 2)

    def test_modified_panel_rejected(self):
        self.panel["observations"][0]["wti_usd_per_barrel"] = 90
        with self.assertRaisesRegex(ValueError, "fingerprint"):
            validate_audit(self.panel, self.audit)

    def test_forged_reason_rejected(self):
        self.audit["blocked"][0]["reason"] = "published_after_decision"
        with self.assertRaisesRegex(ValueError, "reason"):
            validate_audit(self.panel, self.audit)

    def test_missing_or_duplicate_date_rejected(self):
        self.audit["blocked"][1]["date"] = "2025-01-02"
        with self.assertRaisesRegex(ValueError, "dates"):
            validate_audit(self.panel, self.audit)

    def test_fake_eligibility_rejected(self):
        self.audit["usable_count"] = 1
        with self.assertRaisesRegex(ValueError, "totals"):
            validate_audit(self.panel, self.audit)

    def test_claimed_publication_evidence_not_authenticated(self):
        self.panel["observations"][0]["availability_evidence"] = {"source": "self-asserted"}
        self.audit = assess_asof(self.panel, "2026-11-04T00:00:00Z")
        with self.assertRaisesRegex(ValueError, "external authentication"):
            validate_audit(self.panel, self.audit)


if __name__ == "__main__":
    unittest.main()
