import unittest
from intelligence.treasury_history import build, parse_xml

HEADER = b'<feed xmlns="http://www.w3.org/2005/Atom" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices">'
FOOTER = b'</feed>'

def entry(day, rate):
    return (f'<entry><content><m:properties><d:NEW_DATE>{day}T00:00:00</d:NEW_DATE>'
            f'<d:BC_10YEAR>{rate}</d:BC_10YEAR></m:properties></content></entry>').encode()


class TreasuryHistoryTests(unittest.TestCase):
    def test_parse_date_and_yield(self):
        xml = HEADER + entry('2025-01-02', '4.45') + entry('2024-12-31', '4.00') + FOOTER
        self.assertEqual(parse_xml(xml, 2025), [{'date': '2025-01-02', 'ten_year_yield_percent': 4.45}])

    def test_conflicting_revisions_rejected(self):
        xml = HEADER + entry('2025-01-02', '4.45') + entry('2025-01-02', '4.50') + FOOTER
        with self.assertRaisesRegex(ValueError, 'conflicting'):
            parse_xml(xml, 2025)

    def test_empty_source_rejected(self):
        with self.assertRaisesRegex(ValueError, 'no usable'):
            build(2025, fetch=lambda url: HEADER + FOOTER)

    def test_source_and_no_edge_claim(self):
        result = build(2025, fetch=lambda url: HEADER + entry('2025-01-02', '4.45') + FOOTER)
        self.assertEqual(result['observations'][0]['ten_year_yield_percent'], 4.45)
        self.assertEqual(result['predictive_advantage'], 'not_established')
        self.assertEqual(result['relationships'], [])


if __name__ == '__main__':
    unittest.main()
