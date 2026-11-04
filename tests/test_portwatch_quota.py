import unittest
from unittest.mock import patch
import json
import fetch_data

class PortwatchTests(unittest.TestCase):
    def test_quota_response_stops_after_one_request(self):
        calls = []
        def fake(url, timeout=60):
            calls.append(url)
            return json.dumps({"error":{"code":429,"message":"quota exceeded"}}).encode()
        with patch.object(fetch_data, "get", side_effect=fake):
            with self.assertRaisesRegex(RuntimeError, "quota"):
                fetch_data._pw({"where":"1=1","f":"json"})
        self.assertEqual(len(calls), 1)
