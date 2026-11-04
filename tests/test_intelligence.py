import unittest
from intelligence.events import DOMAINS, observation, relationship, validate_graph


class IntelligenceFoundation(unittest.TestCase):
    def make_event(self, id, domain):
        return observation(id=id, domain=domain, title="Example measurement",
                           observed_at="2026-11-04T12:00:00-06:00",
                           source={"name": "Example source", "url": "https://example.org/data"},
                           missing=["Independent corroboration"])

    def test_nine_domains(self):
        self.assertEqual(len(DOMAINS), 9)
        for domain in DOMAINS:
            self.assertEqual(self.make_event(domain, domain)["domain"], domain)

    def test_normalized_time_and_missing_evidence(self):
        event = self.make_event("wx-1", "weather")
        self.assertEqual(event["observed_at"], "2026-11-04T18:00:00Z")
        self.assertIn("Independent corroboration", event["missing"])

    def test_rejects_unattributed_or_naive_observations(self):
        with self.assertRaises(ValueError):
            observation(id="x", domain="weather", title="X",
                        observed_at="2026-11-04T12:00:00", source={"name": "Unknown", "url": "x"})
        with self.assertRaises(ValueError):
            observation(id="x", domain="weather", title="X",
                        observed_at="2026-11-04T12:00:00Z", source={})

    def test_relationship_is_explicitly_unproven(self):
        a, b = self.make_event("wx", "weather"), self.make_event("oil", "energy")
        link = relationship(id="link-1", from_event="wx", to_event="oil",
                            kind="hypothesized_transmission", explanation="Possible infrastructure exposure",
                            evidence_ids=["wx", "oil"], counterarguments=["No observed price response"],
                            missing=["Exposure map"])
        self.assertTrue(validate_graph([a, b], [link]))
        self.assertEqual(link["status"], "hypothesis")
        self.assertEqual(link["predictive_advantage"], "not_established")

    def test_rejects_unknown_evidence(self):
        a, b = self.make_event("wx", "weather"), self.make_event("oil", "energy")
        link = relationship(id="link-1", from_event="wx", to_event="oil",
                            kind="exposure", explanation="Possible exposure", evidence_ids=["missing"])
        with self.assertRaises(ValueError):
            validate_graph([a, b], [link])


if __name__ == "__main__":
    unittest.main()
